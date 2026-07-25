import { loadEnvConfig } from "@next/env";
import { fetchAllYouthCenterPolicies } from "../lib/ingest/youthcenter/client";
import { analyzeYouthCenterDuplicates } from "../lib/ingest/youthcenter/dedup";
import { prepareYouthCenterPolicies } from "../lib/ingest/youthcenter/prepare";
import { loadExistingAnnouncementsForDedup } from "../lib/ingest/youthcenter/store";

loadEnvConfig(process.cwd());

async function main() {
  const fetched = await fetchAllYouthCenterPolicies();
  const prepared = prepareYouthCenterPolicies(fetched.records);
  const { mapped, unique } = prepared;
  const included = unique.filter((policy) => policy.included);
  const excluded = unique.filter((policy) => !policy.included);
  const existing = await loadExistingAnnouncementsForDedup();
  const duplicates = analyzeYouthCenterDuplicates(included, existing);
  const existingYouthCenterKeys = new Set(
    existing
      .filter((row) => row.sourceCode === "youthcenter")
      .map((row) => row.sourceKey),
  );
  const expectedNew = included.filter(
    (policy) =>
      !existingYouthCenterKeys.has(policy.sourceExternalId) &&
      !duplicates.strongYouthcenterIds.has(policy.sourceExternalId),
  ).length;

  const report = {
    mode: "dry-run",
    databaseWrite: false,
    apiVariant: fetched.apiVariant,
    pagesFetched: fetched.pagesFetched,
    apiReportedTotal: fetched.reportedTotal,
    rawCount: fetched.records.length,
    parsedCount: mapped.length,
    parseFailureCount: prepared.parseFailureCount,
    includedCount: included.length,
    excludedCount: excluded.length,
    internalDuplicateCount: prepared.internalDuplicateCount,
    existingDatabaseCount: existing.length,
    strongDuplicateCount: duplicates.strongCount,
    possibleDuplicateCount: duplicates.possibleCount,
    expectedNewCount: expectedNew,
    dateParseFailureCount: prepared.dateParseFailureCount,
    unresolvedRegionCount: unique.filter(
      (policy) =>
        policy.regionResolution === "unknown" ||
        policy.regionResolution === "multiple",
    ).length,
    multipleRegionCount: unique.filter(
      (policy) => policy.regionResolution === "multiple",
    ).length,
    unknownDomainCount: unique.filter(
      (policy) => policy.policyDomain === "unknown",
    ).length,
    closedWithoutEndDateCount: unique.filter(
      (policy) => policy.status === "closed" && !policy.applyEnd,
    ).length,
    fieldMissing: Object.fromEntries(
      [...prepared.fieldMissing.entries()].sort(
        (left, right) => right[1] - left[1],
      ),
    ),
    exclusionReasons: countBy(excluded, (policy) => policy.inclusionReason),
    policyDomains: countBy(unique, (policy) => policy.policyDomain),
    statuses: countBy(unique, (policy) => policy.status),
    sourceStatuses: countBy(unique, (policy) => policy.sourceStatus),
  };

  console.log("[온통청년 전체 수집·중복 분석 dry-run: DB 쓰기 없음]");
  console.log(JSON.stringify(report, null, 2));
  printExamples("강한 중복 사례", duplicates.strongExamples);
  printExamples("중복 가능성 사례", duplicates.possibleExamples);
}

function countBy<T>(values: T[], key: (value: T) => string) {
  const counts = new Map<string, number>();
  for (const value of values) {
    const label = key(value);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Object.fromEntries(
    [...counts.entries()].sort((left, right) => right[1] - left[1]),
  );
}

function printExamples(label: string, examples: unknown[]) {
  console.log(`\n[${label}: 최대 20건]`);
  console.log(JSON.stringify(examples.slice(0, 20), null, 2));
}

main().catch((error) => {
  const message = error instanceof Error
    ? error.message
    : "온통청년 dry-run 실행 실패";
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
