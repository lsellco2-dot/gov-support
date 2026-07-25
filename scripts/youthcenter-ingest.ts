import { loadEnvConfig } from "@next/env";
import { fetchAllYouthCenterPolicies } from "../lib/ingest/youthcenter/client";
import { analyzeYouthCenterDuplicates } from "../lib/ingest/youthcenter/dedup";
import { prepareYouthCenterPolicies } from "../lib/ingest/youthcenter/prepare";
import {
  assertYouthCenterSchemaReady,
  buildYouthCenterSyncPlan,
  ensureYouthCenterSource,
  loadExistingAnnouncementsForDedup,
  loadExistingYouthCenterAnnouncements,
  storeYouthCenterPlan,
} from "../lib/ingest/youthcenter/store";

loadEnvConfig(process.cwd());

async function main() {
  // 이 함수가 반환됐다는 것은 모든 API 페이지를 오류 없이 읽었다는 뜻이다.
  // 그 전에는 Supabase 쓰기 함수가 호출되지 않는다.
  const fetched = await fetchAllYouthCenterPolicies();
  const prepared = prepareYouthCenterPolicies(fetched.records);

  await assertYouthCenterSchemaReady();
  const existingForDedup = await loadExistingAnnouncementsForDedup();
  const included = prepared.unique.filter((policy) => policy.included);
  const duplicates = analyzeYouthCenterDuplicates(
    included,
    existingForDedup,
  );

  const source = await ensureYouthCenterSource();
  const existingYouthCenter = await loadExistingYouthCenterAnnouncements(
    source.sourceId,
  );
  const plan = buildYouthCenterSyncPlan(
    prepared.unique,
    existingYouthCenter,
    source.sourceId,
  );
  const stored = await storeYouthCenterPlan(
    source.sourceId,
    source.created,
    plan,
  );

  console.log("[온통청년 전체 수집 저장 완료]");
  console.log(JSON.stringify({
    apiVariant: fetched.apiVariant,
    pagesFetched: fetched.pagesFetched,
    rawCount: fetched.records.length,
    parsedCount: prepared.mapped.length,
    parseFailureCount: prepared.parseFailureCount,
    internalDuplicateCount: prepared.internalDuplicateCount,
    activeTargetCount: plan.activeUpserts.length,
    activeUpserted: stored.activeUpserted,
    closedSyncTargetCount: plan.closedUpdates.length,
    closedUpdated: stored.closedUpdated,
    closedWithoutEndDate: stored.closedWithoutEndDate,
    absentExistingRowsUntouched: stored.absentExistingRowsUntouched,
    strongDuplicateCount: duplicates.strongCount,
    possibleDuplicateCount: duplicates.possibleCount,
    sourceStatuses: countBy(
      prepared.unique,
      (policy) => policy.sourceStatus,
    ),
    sourceCreated: stored.sourceCreated,
  }, null, 2));
}

function countBy<T>(values: T[], key: (value: T) => string) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = key(value);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Object.fromEntries(counts);
}

main().catch((error) => {
  const message = error instanceof Error
    ? error.message
    : "온통청년 전체 수집 저장 실패";
  console.error(redactSecrets(message));
  process.exitCode = 1;
});

function redactSecrets(value: string) {
  const secrets = [
    process.env.YOUTHCENTER_API_KEY,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ].filter((secret): secret is string => Boolean(secret));
  return secrets.reduce(
    (message, secret) => message.replaceAll(secret, "[REDACTED]"),
    value,
  );
}
