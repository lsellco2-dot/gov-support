import { supabaseAdmin } from "@/lib/supabase/server";
import {
  fetchYouthCenterDetail,
  YouthCenterDetailFetchError,
  youthCenterDetailSourceHash,
} from "./detail";

const DETAIL_CONCURRENCY = 3;
const DB_PAGE_SIZE = 1_000;
const RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface YouthCenterDetailStateRow {
  id: number;
  source_key: string;
  raw_json: unknown;
  apply_end: string | null;
  source_status: string | null;
  detail_source_hash: string | null;
  detail_fetched_at: string | null;
  detail_fetch_status: string | null;
  detail_fetch_error: string | null;
  detail_fetch_attempted_at: string | null;
}

export interface YouthCenterDetailCandidate {
  id: number;
  sourceKey: string;
  rawJson: unknown;
  sourceHash: string;
  applyEnd: string | null;
  sourceStatus: string | null;
}

export interface YouthCenterDetailSelection {
  candidates: YouthCenterDetailCandidate[];
  totalEligible: number;
  skippedCooldown: number;
}

export interface YouthCenterDetailStoreResult {
  fetched: number;
  failed: number;
  writeCount: number;
}

export async function loadYouthCenterDetailCandidates(
  sourceId: number,
  options: {
    limit?: number | null;
    ignoreRetryDelay?: boolean;
  } = {},
): Promise<YouthCenterDetailSelection> {
  const rows: YouthCenterDetailStateRow[] = [];
  for (let from = 0; ; from += DB_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select(
        "id,source_key,raw_json,apply_end,source_status,detail_source_hash,detail_fetched_at,detail_fetch_status,detail_fetch_error,detail_fetch_attempted_at",
      )
      .eq("source_id", sourceId)
      .order("id", { ascending: false })
      .range(from, from + DB_PAGE_SIZE - 1);
    if (error) {
      throw new Error(`온통청년 원문 대상 조회 실패: ${error.message}`);
    }

    const page = (data ?? []) as YouthCenterDetailStateRow[];
    rows.push(...page);
    if (page.length < DB_PAGE_SIZE) break;
  }

  const eligible: YouthCenterDetailCandidate[] = [];
  let skippedCooldown = 0;
  for (const row of rows) {
    const sourceHash = youthCenterDetailSourceHash(row.raw_json);
    if (
      row.detail_fetched_at &&
      row.detail_source_hash === sourceHash
    ) {
      continue;
    }
    if (
      !options.ignoreRetryDelay &&
      row.detail_fetch_status === "failed" &&
      !retryIntervalElapsed(row.detail_fetch_attempted_at)
    ) {
      skippedCooldown++;
      continue;
    }
    eligible.push({
      id: Number(row.id),
      sourceKey: String(row.source_key),
      rawJson: row.raw_json,
      sourceHash,
      applyEnd: nullableString(row.apply_end),
      sourceStatus: nullableString(row.source_status),
    });
  }

  eligible.sort(compareCandidates);
  const limit =
    options.limit === null
      ? eligible.length
      : Math.max(0, Math.floor(options.limit ?? 8));
  return {
    candidates: eligible.slice(0, limit),
    totalEligible: eligible.length,
    skippedCooldown,
  };
}

export async function fetchAndStoreYouthCenterDetails(
  candidates: YouthCenterDetailCandidate[],
  sourceId: number,
  onProgress?: (progress: {
    processed: number;
    total: number;
    fetched: number;
    failed: number;
  }) => void,
): Promise<YouthCenterDetailStoreResult> {
  let cursor = 0;
  let processed = 0;
  let fetched = 0;
  let failed = 0;
  let writeCount = 0;

  async function worker() {
    while (cursor < candidates.length) {
      const candidate = candidates[cursor++];
      const attemptedAt = new Date().toISOString();
      try {
        const detail = await fetchYouthCenterDetail(candidate.sourceKey);
        const { error } = await supabaseAdmin
          .from("announcements")
          .update({
            detail_content: detail.detailContent,
            apply_method: detail.applyMethod,
            documents: detail.documents,
            contact: detail.contact,
            attachments: detail.attachments,
            detail_content_hash: detail.contentHash,
            detail_source_hash: candidate.sourceHash,
            detail_fetched_at: attemptedAt,
            detail_fetch_attempted_at: attemptedAt,
            detail_fetch_status: "success",
            detail_fetch_error: null,
          })
          .eq("id", candidate.id)
          .eq("source_id", sourceId)
          .eq("source_key", candidate.sourceKey);
        writeCount++;

        if (error) {
          failed++;
          console.error(
            `[youthcenter] 원문 저장 실패 (${candidate.sourceKey}):`,
            error.message,
          );
        } else {
          fetched++;
        }
      } catch (error) {
        failed++;
        const reason =
          error instanceof YouthCenterDetailFetchError
            ? error.publicReason
            : "온통청년 원문 호출 실패";
        console.error(
          `[youthcenter] 원문 수집 실패 (${candidate.sourceKey}):`,
          error instanceof Error ? error.message : "unknown error",
        );
        const { error: statusError } = await supabaseAdmin
          .from("announcements")
          .update({
            detail_fetch_attempted_at: attemptedAt,
            detail_fetch_status: "failed",
            detail_fetch_error: reason.slice(0, 200),
          })
          .eq("id", candidate.id)
          .eq("source_id", sourceId)
          .eq("source_key", candidate.sourceKey);
        writeCount++;
        if (statusError) {
          console.error(
            `[youthcenter] 원문 실패 상태 저장 오류 (${candidate.sourceKey}):`,
            statusError.message,
          );
        }
      } finally {
        processed++;
        onProgress?.({
          processed,
          total: candidates.length,
          fetched,
          failed,
        });
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(DETAIL_CONCURRENCY, candidates.length) },
      () => worker(),
    ),
  );
  return { fetched, failed, writeCount };
}

export function shouldFetchYouthCenterDetail(input: {
  rawJson: unknown;
  detailSourceHash: string | null;
  detailFetchedAt: string | null;
  detailFetchStatus: string | null;
  detailFetchAttemptedAt: string | null;
  now?: number;
}) {
  const sourceHash = youthCenterDetailSourceHash(input.rawJson);
  if (
    input.detailFetchedAt &&
    input.detailSourceHash === sourceHash
  ) {
    return false;
  }
  if (
    input.detailFetchStatus === "failed" &&
    !retryIntervalElapsed(input.detailFetchAttemptedAt, input.now)
  ) {
    return false;
  }
  return true;
}

function retryIntervalElapsed(
  attemptedAt: string | null,
  now = Date.now(),
) {
  if (!attemptedAt) return true;
  const attempted = Date.parse(attemptedAt);
  return (
    !Number.isFinite(attempted) ||
    now - attempted >= RETRY_INTERVAL_MS
  );
}

function compareCandidates(
  left: YouthCenterDetailCandidate,
  right: YouthCenterDetailCandidate,
) {
  const statusDifference =
    statusPriority(left.sourceStatus) - statusPriority(right.sourceStatus);
  if (statusDifference !== 0) return statusDifference;

  const leftEnd = left.applyEnd ?? "9999-12-31";
  const rightEnd = right.applyEnd ?? "9999-12-31";
  const endDifference = leftEnd.localeCompare(rightEnd);
  return endDifference !== 0 ? endDifference : right.id - left.id;
}

function statusPriority(value: string | null) {
  if (value === "open" || value === "upcoming" || value === "always") {
    return 0;
  }
  if (value === "unknown") return 1;
  return 2;
}

function nullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
