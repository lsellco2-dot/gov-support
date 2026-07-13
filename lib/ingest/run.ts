import { supabaseAdmin } from "@/lib/supabase/server";
import { adapters } from "./adapters";
import { mapCategories } from "./category";
import { contentHash } from "./hash";
import { SOURCE_ID, type NormalizedAnnouncement } from "./types";
import { sanitizeDisplayText } from "@/lib/text/sanitize";
import {
  fetchAndStoreDetails,
  loadExistingDetailStates,
  needsDetailFetch,
} from "./detail-store";
import {
  canonicalTitle,
  createDuplicateIndex,
  isPreferredSourceDuplicate,
  type DuplicateIndex,
} from "./cross-source-dedup";

const CHUNK = 500;
const EXPIRED_RETENTION_DAYS = 2;

export interface IngestResult {
  source: string;
  upserted: number;
  skipped: number;
  failed: number;
  detailsFetched: number;
  detailsFailed: number;
  detailsSkipped: number;
  detailsPending: number;
  detailSchemaReady?: boolean;
  duplicatesSkipped: number;
  error?: string;
}

export interface ExpiredCleanupResult {
  deleted: number;
  deleteBefore: string;
  error?: string;
}

export async function runIngest(only?: string[]): Promise<IngestResult[]> {
  const serviceKey = process.env.DATA_GO_KR_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_KEY 환경변수가 없습니다.");

  const targets = adapters.filter(
    (a) => !only || only.length === 0 || only.includes(a.sourceCode)
  );

  const results: IngestResult[] = [];
  const deleteBefore = expiredDeleteBeforeDate();

  for (const adapter of targets) {
    const r: IngestResult = {
      source: adapter.sourceCode,
      upserted: 0,
      skipped: 0,
      failed: 0,
      detailsFetched: 0,
      detailsFailed: 0,
      detailsSkipped: 0,
      detailsPending: 0,
      duplicatesSkipped: 0,
    };
    let detailBudget = detailFetchLimitPerSource();
    let detailSchemaReady: boolean | undefined;
    let preferredSourceIndex: DuplicateIndex | null = null;
    const seenMssTitles = new Set<string>();

    try {
      if (adapter.sourceCode === "mss") {
        preferredSourceIndex = await loadPreferredSourceDuplicateIndex();
      }
      for await (const page of adapter.fetchPages({ serviceKey })) {
        const prepared: Array<{
          normalized: NormalizedAnnouncement;
          row: ReturnType<typeof toRow>;
        }> = [];
        for (const raw of page) {
          const n = adapter.normalize(raw);
          if (!n) { r.skipped++; continue; }
          if (adapter.sourceCode === "mss") {
            const canonical = canonicalTitle(n.title);
            if (
              seenMssTitles.has(canonical) ||
              (preferredSourceIndex &&
                isPreferredSourceDuplicate(
                  { title: n.title, applyEnd: n.applyEnd },
                  preferredSourceIndex
                ))
            ) {
              r.skipped++;
              r.duplicatesSkipped++;
              continue;
            }
            seenMssTitles.add(canonical);
          }
          if (n.applyEnd && n.applyEnd < deleteBefore) {
            r.skipped++;
            continue;
          }
          prepared.push({ normalized: n, row: toRow(n) });
        }

        let detailCandidates: NormalizedAnnouncement[] = [];
        if (detailBudget > 0 && detailSchemaReady !== false && prepared.length > 0) {
          const lookup = await loadExistingDetailStates(
            SOURCE_ID[adapter.sourceCode],
            prepared.map(({ normalized }) => normalized.sourceKey)
          );
          detailSchemaReady = lookup.schemaReady;
          r.detailSchemaReady = lookup.schemaReady;

          if (lookup.schemaReady && lookup.lookupReady) {
            const eligible: NormalizedAnnouncement[] = [];
            for (const { normalized } of prepared) {
              if (!normalized.detailUrl) {
                r.detailsSkipped++;
              } else if (needsDetailFetch(normalized, lookup.states.get(normalized.sourceKey))) {
                eligible.push(normalized);
              } else {
                r.detailsSkipped++;
              }
            }
            detailCandidates = eligible.slice(0, detailBudget);
            r.detailsPending += Math.max(0, eligible.length - detailCandidates.length);
          } else if (lookup.schemaReady) {
            r.detailsPending += prepared.filter(({ normalized }) => normalized.detailUrl).length;
          }
        }

        const rows = prepared.map(({ row }) => row);
        const successfulKeys = new Set<string>();
        for (let i = 0; i < rows.length; i += CHUNK) {
          const chunk = rows.slice(i, i + CHUNK);
          const { error } = await supabaseAdmin
            .from("announcements")
            .upsert(chunk, { onConflict: "source_id,source_key" });
          if (error) {
            r.failed += chunk.length;
            console.error(`[${adapter.sourceCode}] upsert 실패:`, error.message);
          } else {
            r.upserted += chunk.length;
            for (const row of chunk) successfulKeys.add(row.source_key);
          }
        }

        if (detailSchemaReady === false) {
          r.detailsPending += prepared.filter(({ normalized }) => normalized.detailUrl).length;
        } else if (detailCandidates.length > 0) {
          const stored = await fetchAndStoreDetails(
            detailCandidates.filter((candidate) => successfulKeys.has(candidate.sourceKey)),
            SOURCE_ID[adapter.sourceCode]
          );
          r.detailsFetched += stored.fetched;
          r.detailsFailed += stored.failed;
          detailBudget -= detailCandidates.length;
        }
      }
    } catch (e: any) {
      // 어댑터 하나가 실패해도 나머지는 계속
      const internalError = e?.message ?? String(e);
      r.error = "수집 실패";
      console.error(`[${adapter.sourceCode}] 수집 중단:`, internalError);
    }

    if (!r.error && r.failed === 0) {
      await supabaseAdmin
        .from("sources")
        .update({ last_fetched_at: new Date().toISOString() })
        .eq("code", adapter.sourceCode);
    }

    results.push(r);
  }

  return results;
}

function detailFetchLimitPerSource() {
  const configured = Number(process.env.DETAIL_FETCH_LIMIT_PER_SOURCE ?? 8);
  if (!Number.isFinite(configured)) return 8;
  return Math.min(20, Math.max(0, Math.floor(configured)));
}

export async function purgeExpiredAnnouncements(): Promise<ExpiredCleanupResult> {
  const deleteBefore = expiredDeleteBeforeDate();
  const { count, error } = await supabaseAdmin
    .from("announcements")
    .delete({ count: "exact" })
    .lt("apply_end", deleteBefore);

  if (error) {
    console.error("[cleanup] expired announcement deletion failed:", error.message);
    return { deleted: 0, deleteBefore, error: "마감 공고 정리 실패" };
  }

  return { deleted: count ?? 0, deleteBefore };
}

function expiredDeleteBeforeDate(now = new Date()): string {
  const seoulDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const cutoff = new Date(`${seoulDate}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - EXPIRED_RETENTION_DAYS);
  return cutoff.toISOString().slice(0, 10);
}

function toRow(n: NormalizedAnnouncement) {
  const clean: NormalizedAnnouncement = {
    ...n,
    title: sanitizeDisplayText(n.title),
    organization: sanitizeDisplayText(n.organization),
    region: sanitizeDisplayText(n.region),
    target: sanitizeDisplayText(n.target),
    supportType: sanitizeDisplayText(n.supportType),
    summary: sanitizeDisplayText(n.summary),
  };

  const attachments = n.attachments
    ?.map(({ label, url }) => ({ label: sanitizeDisplayText(label), url }))
    .filter(({ label }) => label.length > 0);

  return {
    source_id: SOURCE_ID[clean.sourceCode],
    source_key: clean.sourceKey,
    title: clean.title,
    organization: clean.organization,
    category_ids: mapCategories(clean),
    region: clean.region ?? "전국",
    target: clean.target,
    support_type: clean.supportType,
    summary: clean.summary,
    apply_start: clean.applyStart,
    apply_end: clean.applyEnd,
    detail_url: clean.detailUrl,
    content_hash: contentHash(clean),
    raw_json: clean.raw,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
    updated_at: new Date().toISOString(),
  };
}

async function loadPreferredSourceDuplicateIndex() {
  const rows: Array<{ title: string; apply_end: string | null }> = [];
  const pageSize = 1_000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select("title,apply_end")
      .in("source_id", [SOURCE_ID.bizinfo, SOURCE_ID.kstartup])
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`중복 기준 공고 조회 실패: ${error.message}`);

    const page = (data ?? []) as Array<{ title: string; apply_end: string | null }>;
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return createDuplicateIndex(
    rows.map((row) => ({ title: row.title, applyEnd: row.apply_end }))
  );
}
