import { loadEnvConfig } from "@next/env";
import {
  runYouthCenterIngest,
  youthCenterIngestErrorCode,
} from "../lib/ingest/youthcenter/run";

loadEnvConfig(process.cwd());

async function main() {
  const report = await runYouthCenterIngest();

  console.log("[온통청년 전체 수집 저장 완료]");
  console.log(JSON.stringify({
    source: report.source,
    apiVariant: report.apiVariant,
    pagesFetched: report.pagesFetched,
    apiCallCount: report.apiCallCount,
    rawCount: report.fetched,
    parsedCount: report.parsed,
    parseFailureCount: report.parseFailures,
    activeTargetCount: report.activeTargets,
    inserted: report.inserted,
    updated: report.updated,
    closedUpdated: report.closedSynced,
    dbWriteCount: report.dbWriteCount,
    fetchDurationMs: report.fetchDurationMs,
    transformDurationMs: report.transformDurationMs,
    upsertDurationMs: report.upsertDurationMs,
    durationMs: report.durationMs,
    sourceCreated: report.sourceCreated,
  }, null, 2));
}

main().catch((error) => {
  console.error("[온통청년 전체 수집 저장 실패]", {
    errorCode: youthCenterIngestErrorCode(error),
  });
  process.exitCode = 1;
});
