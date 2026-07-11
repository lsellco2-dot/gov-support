import { supabaseAdmin } from "@/lib/supabase/server";
import { adapters } from "./adapters";
import { mapCategories } from "./category";
import { contentHash } from "./hash";
import { SOURCE_ID, type NormalizedAnnouncement } from "./types";
import { sanitizeDisplayText } from "@/lib/text/sanitize";

const CHUNK = 500;
const EXPIRED_RETENTION_DAYS = 2;

export interface IngestResult {
  source: string;
  upserted: number;
  skipped: number;
  failed: number;
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
    const r: IngestResult = { source: adapter.sourceCode, upserted: 0, skipped: 0, failed: 0 };
    try {
      for await (const page of adapter.fetchPages({ serviceKey })) {
        const rows = [];
        for (const raw of page) {
          const n = adapter.normalize(raw);
          if (!n) { r.skipped++; continue; }
          if (n.applyEnd && n.applyEnd < deleteBefore) {
            r.skipped++;
            continue;
          }
          rows.push(toRow(n));
        }
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
          }
        }
      }
    } catch (e: any) {
      // 어댑터 하나가 실패해도 나머지는 계속
      r.error = e?.message ?? String(e);
      console.error(`[${adapter.sourceCode}] 수집 중단:`, r.error);
    }

    await supabaseAdmin
      .from("sources")
      .update({ last_fetched_at: new Date().toISOString() })
      .eq("code", adapter.sourceCode);

    results.push(r);
  }

  return results;
}

export async function purgeExpiredAnnouncements(): Promise<ExpiredCleanupResult> {
  const deleteBefore = expiredDeleteBeforeDate();
  const { count, error } = await supabaseAdmin
    .from("announcements")
    .delete({ count: "exact" })
    .lt("apply_end", deleteBefore);

  if (error) {
    console.error("[cleanup] expired announcement deletion failed:", error.message);
    return { deleted: 0, deleteBefore, error: error.message };
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
    updated_at: new Date().toISOString(),
  };
}
