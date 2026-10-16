import { loadEnvConfig } from "@next/env";
import { BOKJI_DAILY_LIMITS, parseScheduledOptions, runClaimedJob, selectBokjiDetails, type BokjiDetailRow } from "../lib/ingest/scheduled-policy";

async function main() {
  loadEnvConfig(process.env.AISUP_ENV_DIR ?? process.cwd());
  const { source, apply } = parseScheduledOptions(process.argv.slice(2));
  const { supabaseAdmin: db } = await import("../lib/supabase/server");
  const { bokjiCentral, bokjiLocal } = await import("../lib/ingest/adapters/bokji");
  const { fetchAndStoreDetails } = await import("../lib/ingest/detail-store");
  const adapter = source === "bokji-central" ? bokjiCentral : bokjiLocal;
  const lookup = await db.from("sources").select("id,enabled").eq("code", source).single();
  if (lookup.error || !lookup.data?.enabled) throw new Error("SCHEDULED_SOURCE_UNAVAILABLE");
  const sourceId = lookup.data.id;
  const started = performance.now();
  const loadCandidates = async () => {
    const rows: BokjiDetailRow[] = [];
    for (let from = 0; ; from += 500) {
      const { data, error } = await db.from("announcements")
        .select("id,source_key,raw_json,detail_source_hash,detail_fetched_at,detail_fetch_attempted_at")
        .eq("source_id", sourceId).order("id").range(from, from + 499);
      if (error) throw new Error("BOKJI_DETAIL_QUEUE_READ_FAILED");
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < 500) break;
    }
    return selectBokjiDetails(rows, source as keyof typeof BOKJI_DAILY_LIMITS);
  };

  if (!apply) {
    // API 호출과 실행권 저장 없이 현재 DB 대기열만 조회한다.
    const queue = source === "enara" ? null : await loadCandidates();
    console.log(JSON.stringify({ mode: "dry-run", source, pending: queue?.pending, selected: queue?.selected.length }));
    return;
  }
  for (const name of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DATA_GO_KR_KEY"]) {
    if (!process.env[name]) throw new Error("SCHEDULED_ENV_MISSING");
  }

  const outcome = await runClaimedJob(
    async () => {
      const { data, error } = await db.rpc("claim_daily_ingest_job", { p_job_key: source });
      if (error) throw new Error("SCHEDULED_CLAIM_FAILED");
      return data as string | null;
    },
    async () => {
      if (source === "enara") {
        process.env.INGEST_ENARA_ENABLED = "true";
        const { runIngest } = await import("../lib/ingest/run");
        const results = await runIngest([source]);
        console.log(JSON.stringify({ source, results }));
        if (results.length !== 1 || results.some(r => r.error || r.failed || r.detailsFailed)) throw new Error("ENARA_INGEST_FAILED");
        return { ...results[0], durationMs: Math.round(performance.now() - started) };
      }
      const { selected, pending } = await loadCandidates();
      let attempted = 0, fetched = 0, failed = 0;
      for (let from = 0; from < selected.length; from += 3) {
        const items = selected.slice(from, from + 3).map(row => {
          const item = adapter.normalize(row.raw_json);
          if (!item || item.sourceKey !== row.source_key) throw new Error("BOKJI_DETAIL_QUEUE_INVALID");
          return item;
        });
        const result = await fetchAndStoreDetails(items, sourceId, adapter.fetchDetail);
        attempted += items.length;
        fetched += result.fetched;
        failed += result.failed;
        // API 장애/한도 오류 때 잔여 요청을 소진하지 않는다. 자동 재시도 없음.
        if (result.failed > 0) break;
        if (attempted % 30 === 0 || attempted === selected.length) {
          console.log(JSON.stringify({ source, attempted, fetched, failed, selected: selected.length }));
        }
      }
      const summary = { source, pendingBefore: pending, attempted, fetched, failed, durationMs: Math.round(performance.now() - started) };
      console.log(JSON.stringify(summary));
      return summary;
    },
    async (id, status, result) => {
      const failed = result && "failed" in result && Number(result.failed) > 0;
      const { error } = await db.from("ingest_daily_jobs").update({
        status: failed ? "failed" : status, finished_at: new Date().toISOString(), summary: result ?? { error: "JOB_FAILED" },
      }).eq("id", id);
      if (error) throw new Error("SCHEDULED_RESULT_WRITE_FAILED");
    },
  );
  console.log(JSON.stringify({ source, skipped: outcome.skipped, reason: outcome.skipped ? "ALREADY_CLAIMED_TODAY" : undefined }));
  if (!outcome.skipped && outcome.result.failed > 0) process.exitCode = 1;
}

main().catch(() => { console.error("SCHEDULED_JOB_FAILED: 집계 로그와 운영 실행 기록을 확인하세요."); process.exitCode = 1; });
