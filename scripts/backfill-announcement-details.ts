import { loadEnvConfig } from "@next/env";
import { adapters } from "../lib/ingest/adapters";
import {
  fetchAndStoreDetails,
  FINAL_EMPTY_SHELL_ERROR,
} from "../lib/ingest/detail-store";
import { SOURCE_ID, type NormalizedAnnouncement } from "../lib/ingest/types";
import { supabaseAdmin } from "../lib/supabase/server";

loadEnvConfig(process.cwd());

const DEFAULT_LIMIT = 20;
const QUERY_PAGE_SIZE = 500;
const BATCH_SIZE = 3;
const EMPTY_SHELL_RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000;

interface BackfillRow {
  id: number;
  source_id: number;
  source_key: string;
  raw_json: unknown;
  apply_end: string | null;
}

interface Options {
  dryRun: boolean;
  all: boolean;
  limit: number;
}

const sourceEntries = adapters.map((adapter) => ({
  adapter,
  sourceId: SOURCE_ID[adapter.sourceCode],
}));
const supportedSourceIds = sourceEntries.map(({ sourceId }) => sourceId);

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const counts = await loadTargetCounts();
  const emptyShellCounts = await loadFinalEmptyShellCounts();
  const cooldownCounts = await loadEmptyShellCooldownCounts();
  const total = [...counts.values()].reduce((sum, count) => sum + count, 0);
  const initiallyExcluded = [...emptyShellCounts.values()].reduce(
    (sum, count) => sum + count,
    0
  );

  console.log(`원문 미수집 대상: ${total}건`);
  for (const { adapter } of sourceEntries) {
    console.log(
      `  [${adapter.sourceCode}] 대상 ${counts.get(adapter.sourceCode) ?? 0}건 · ` +
        `빈 셸 마감 제외 ${emptyShellCounts.get(adapter.sourceCode) ?? 0}건 · ` +
        `모집 중 재시도 대기 ${cooldownCounts.get(adapter.sourceCode) ?? 0}건`
    );
  }

  const requested = options.all ? total : Math.min(options.limit, total);
  if (options.dryRun) {
    console.log(`dry-run: DB 변경 없음, 실제 실행 시 최대 ${requested}건 처리`);
    return;
  }
  if (requested === 0) {
    console.log("처리할 공고가 없습니다.");
    return;
  }

  const rows = await loadPriorityTargets(requested);
  let succeeded = 0;
  let failed = 0;
  let emptyShellDetected = 0;
  let emptyShellFinalized = 0;
  let processed = 0;

  for (let index = 0; index < rows.length; index += BATCH_SIZE) {
    const batchRows = rows.slice(index, index + BATCH_SIZE);
    const grouped = normalizeBySource(batchRows);
    failed += batchRows.length - grouped.normalizedCount;

    for (const [sourceId, announcements] of grouped.bySource) {
      const result = await fetchAndStoreDetails(announcements, sourceId);
      succeeded += result.fetched;
      failed += result.failed - result.emptyShell;
      emptyShellDetected += result.emptyShell;
      emptyShellFinalized += result.emptyShellFinalized;
    }

    processed += batchRows.length;
    const remaining = Math.max(0, total - succeeded - emptyShellFinalized);
    console.log(
      `진행 ${processed}/${rows.length}건 · 성공 ${succeeded} · 실패 ${failed} · ` +
      `빈 셸 감지 ${emptyShellDetected} · 빈 셸 2회 도달 ${emptyShellFinalized} · 잔여 ${remaining}`
    );
  }

  console.log(
      `백필 종료: 성공 ${succeeded}건, 실패 ${failed}건, ` +
      `빈 셸 감지 ${emptyShellDetected}건, ` +
      `실행 전 마감 빈 셸 제외 ${initiallyExcluded}건, ` +
      `잔여 ${Math.max(0, total - succeeded - emptyShellFinalized)}건`
  );
}

function parseOptions(args: string[]): Options {
  let dryRun = false;
  let all = false;
  let limit = DEFAULT_LIMIT;
  let hasLimit = false;

  for (const arg of args) {
    if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--all") {
      all = true;
    } else if (arg.startsWith("--limit=")) {
      const value = Number(arg.slice("--limit=".length));
      if (!Number.isInteger(value) || value < 1) {
        throw new Error("--limit은 1 이상의 정수여야 합니다.");
      }
      limit = value;
      hasLimit = true;
    } else {
      throw new Error(`지원하지 않는 옵션입니다: ${arg}`);
    }
  }

  if (all && hasLimit) {
    throw new Error("--all과 --limit은 함께 사용할 수 없습니다.");
  }
  return { dryRun, all, limit };
}

async function loadTargetCounts() {
  const counts = new Map<string, number>();
  for (const { adapter, sourceId } of sourceEntries) {
    const { count: ordinaryCount, error: ordinaryError } = await supabaseAdmin
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("source_id", sourceId)
      .is("detail_content", null)
      .not("detail_url", "is", null)
      .or(`detail_fetch_error.is.null,detail_fetch_error.neq.${FINAL_EMPTY_SHELL_ERROR}`);
    if (ordinaryError) {
      throw new Error(`[${adapter.sourceCode}] 대상 건수 조회 실패: ${ordinaryError.message}`);
    }
    const retryableCount = await countRetryableEmptyShell(sourceId);
    counts.set(adapter.sourceCode, (ordinaryCount ?? 0) + retryableCount);
  }
  return counts;
}

async function countRetryableEmptyShell(sourceId: number) {
  const today = todayKst();
  const retryBefore = emptyShellRetryBefore();
  const counts = await Promise.all([
    supabaseAdmin
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("source_id", sourceId)
      .is("detail_content", null)
      .not("detail_url", "is", null)
      .eq("detail_fetch_error", FINAL_EMPTY_SHELL_ERROR)
      .gte("apply_end", today)
      .or(
        `detail_fetch_attempted_at.is.null,detail_fetch_attempted_at.lte.${retryBefore}`
      ),
    supabaseAdmin
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("source_id", sourceId)
      .is("detail_content", null)
      .not("detail_url", "is", null)
      .eq("detail_fetch_error", FINAL_EMPTY_SHELL_ERROR)
      .is("apply_end", null)
      .or(
        `detail_fetch_attempted_at.is.null,detail_fetch_attempted_at.lte.${retryBefore}`
      ),
  ]);
  const error = counts.find((result) => result.error)?.error;
  if (error) throw new Error(`빈 셸 재시도 건수 조회 실패: ${error.message}`);
  return counts.reduce((sum, result) => sum + (result.count ?? 0), 0);
}

async function loadFinalEmptyShellCounts() {
  const counts = new Map<string, number>();
  for (const { adapter, sourceId } of sourceEntries) {
    const today = todayKst();
    const { count: closedCount, error: closedError } = await supabaseAdmin
      .from("announcements")
      .select("id", { count: "exact", head: true })
      .eq("source_id", sourceId)
      .is("detail_content", null)
      .not("detail_url", "is", null)
      .eq("detail_fetch_error", FINAL_EMPTY_SHELL_ERROR)
      .lt("apply_end", today);
    if (closedError) {
      throw new Error(`[${adapter.sourceCode}] 마감 빈 셸 조회 실패: ${closedError.message}`);
    }
    counts.set(adapter.sourceCode, closedCount ?? 0);
  }
  return counts;
}

async function loadEmptyShellCooldownCounts() {
  const counts = new Map<string, number>();
  const today = todayKst();
  const retryAfter = emptyShellRetryBefore();
  for (const { adapter, sourceId } of sourceEntries) {
    const results = await Promise.all([
      supabaseAdmin
        .from("announcements")
        .select("id", { count: "exact", head: true })
        .eq("source_id", sourceId)
        .is("detail_content", null)
        .not("detail_url", "is", null)
        .eq("detail_fetch_error", FINAL_EMPTY_SHELL_ERROR)
        .gte("apply_end", today)
        .gt("detail_fetch_attempted_at", retryAfter),
      supabaseAdmin
        .from("announcements")
        .select("id", { count: "exact", head: true })
        .eq("source_id", sourceId)
        .is("detail_content", null)
        .not("detail_url", "is", null)
        .eq("detail_fetch_error", FINAL_EMPTY_SHELL_ERROR)
        .is("apply_end", null)
        .gt("detail_fetch_attempted_at", retryAfter),
    ]);
    const error = results.find((result) => result.error)?.error;
    if (error) {
      throw new Error(`[${adapter.sourceCode}] 빈 셸 대기 건수 조회 실패: ${error.message}`);
    }
    counts.set(
      adapter.sourceCode,
      results.reduce((sum, result) => sum + (result.count ?? 0), 0)
    );
  }
  return counts;
}

async function loadPriorityTargets(limit: number) {
  const today = todayKst();
  const rows: BackfillRow[] = [];

  await appendBucket(rows, limit, true, (query) =>
    query.gte("apply_end", today).order("apply_end", { ascending: true }).order("id", { ascending: true })
  );
  await appendBucket(rows, limit, true, (query) =>
    query.is("apply_end", null).order("id", { ascending: true })
  );
  await appendBucket(rows, limit, false, (query) =>
    query.lt("apply_end", today).order("apply_end", { ascending: false }).order("id", { ascending: true })
  );

  return rows;
}

async function appendBucket(
  destination: BackfillRow[],
  limit: number,
  includeRetryableEmptyShell: boolean,
  applyBucket: (query: any) => any
) {
  let offset = 0;
  while (destination.length < limit) {
    const size = Math.min(QUERY_PAGE_SIZE, limit - destination.length);
    let query = supabaseAdmin
      .from("announcements")
      .select("id,source_id,source_key,raw_json,apply_end")
      .in("source_id", supportedSourceIds)
      .is("detail_content", null)
      .not("detail_url", "is", null);
    query = includeRetryableEmptyShell
      ? query.or(
          `detail_fetch_error.is.null,` +
            `detail_fetch_error.neq.${FINAL_EMPTY_SHELL_ERROR},` +
            `and(detail_fetch_error.eq.${FINAL_EMPTY_SHELL_ERROR},` +
            `detail_fetch_attempted_at.lte.${emptyShellRetryBefore()}),` +
            `and(detail_fetch_error.eq.${FINAL_EMPTY_SHELL_ERROR},` +
            `detail_fetch_attempted_at.is.null)`
        )
      : query.or(
          `detail_fetch_error.is.null,detail_fetch_error.neq.${FINAL_EMPTY_SHELL_ERROR}`
        );
    query = applyBucket(query);

    const { data, error } = await query.range(offset, offset + size - 1);
    if (error) throw new Error(`백필 대상 조회 실패: ${error.message}`);
    const page = (data ?? []) as BackfillRow[];
    destination.push(...page);
    if (page.length < size) break;
    offset += page.length;
  }
}

function normalizeBySource(rows: BackfillRow[]) {
  const bySource = new Map<number, NormalizedAnnouncement[]>();
  let normalizedCount = 0;

  for (const row of rows) {
    const entry = sourceEntries.find(({ sourceId }) => sourceId === row.source_id);
    const normalized = entry?.adapter.normalize(row.raw_json) ?? null;
    if (!entry || !normalized?.detailUrl) {
      console.error(`[source_id=${row.source_id}] normalize 실패: source_key=${row.source_key}`);
      continue;
    }
    const items = bySource.get(row.source_id) ?? [];
    items.push(normalized);
    bySource.set(row.source_id, items);
    normalizedCount++;
  }

  return { bySource, normalizedCount };
}

function todayKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function emptyShellRetryBefore() {
  return new Date(Date.now() - EMPTY_SHELL_RETRY_INTERVAL_MS).toISOString();
}

main().catch((error) => {
  console.error("백필 실행 실패:", error instanceof Error ? error.message : "알 수 없는 오류");
  process.exitCode = 1;
});
