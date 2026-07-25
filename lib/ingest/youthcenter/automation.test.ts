import assert from "node:assert/strict";
import test from "node:test";
import { adapters } from "../adapters";
import { fetchAllYouthCenterPolicies } from "./client";
import {
  runYouthCenterIngest,
  youthCenterIngestErrorCode,
} from "./run";
import { buildYouthCenterSyncPlan } from "./store";
import type { YouthCenterPolicy } from "./types";

test("legacy HTTP 400 falls back to the current XML endpoint", async () => {
  const responses = [
    new Response("", { status: 400 }),
    new Response(xmlPage(1, 1), {
      status: 200,
      headers: { "content-type": "application/xml" },
    }),
  ];
  const result = await fetchAllYouthCenterPolicies("test-key", {
    fetchImpl: sequenceFetch(responses),
    waitBeforeRetry: async () => {},
  });

  assert.equal(result.apiVariant, "current");
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.records.length, 1);
  assert.equal(result.requestCount, 2);
});

test("first current API page failure stops before any store phase", async () => {
  const responses = [
    new Response("", { status: 400 }),
    new Response("", { status: 503 }),
    new Response("", { status: 503 }),
    new Response("", { status: 503 }),
  ];

  await assert.rejects(
    fetchAllYouthCenterPolicies("test-key", {
      fetchImpl: sequenceFetch(responses),
      waitBeforeRetry: async () => {},
    }),
    /HTTP 503/,
  );
});

test("middle page failure aborts the complete fetch", async () => {
  const responses = [
    new Response("", { status: 400 }),
    new Response(xmlPage(100, 200), {
      status: 200,
      headers: { "content-type": "application/xml" },
    }),
    new Response("", { status: 500 }),
    new Response("", { status: 500 }),
    new Response("", { status: 500 }),
  ];

  await assert.rejects(
    fetchAllYouthCenterPolicies("test-key", {
      fetchImpl: sequenceFetch(responses),
      waitBeforeRetry: async () => {},
    }),
    /HTTP 500/,
  );
});

test("normal and repeated collection classify inserts and updates idempotently", async () => {
  const first = await runYouthCenterIngest({
    apiKey: "test-key",
    dependencies: dependencies([]),
  });
  const second = await runYouthCenterIngest({
    apiKey: "test-key",
    dependencies: dependencies(["P-1"]),
  });

  assert.deepEqual(
    {
      inserted: first.inserted,
      updated: first.updated,
      fetched: first.fetched,
      writes: first.dbWriteCount,
    },
    { inserted: 1, updated: 0, fetched: 1, writes: 2 },
  );
  assert.deepEqual(
    {
      inserted: second.inserted,
      updated: second.updated,
      fetched: second.fetched,
      writes: second.dbWriteCount,
    },
    { inserted: 0, updated: 1, fetched: 1, writes: 2 },
  );
});

test("missing API key, source failure and store failure expose safe error codes", async () => {
  await assert.rejects(
    runYouthCenterIngest({
      apiKey: " ",
      dependencies: dependencies([]),
    }),
    (error) => youthCenterIngestErrorCode(error) === "MISSING_API_KEY",
  );
  await assert.rejects(
    runYouthCenterIngest({
      apiKey: "test-key",
      dependencies: {
        ...dependencies([]),
        ensureSource: async () => {
          throw new Error("database details must stay private");
        },
      },
    }),
    (error) => youthCenterIngestErrorCode(error) === "SOURCE_FAILED",
  );
  await assert.rejects(
    runYouthCenterIngest({
      apiKey: "test-key",
      dependencies: {
        ...dependencies([]),
        storePlan: async () => {
          throw new Error("service key must stay private");
        },
      },
    }),
    (error) => youthCenterIngestErrorCode(error) === "STORE_FAILED",
  );
});

test("existing adapters and YouthCenter automation remain isolated", () => {
  assert.deepEqual(
    adapters.map((adapter) => adapter.sourceCode),
    ["bizinfo", "kstartup", "mss", "mois", "msit"],
  );
});

function dependencies(existingKeys: string[]) {
  let clock = 0;
  return {
    fetchPolicies: async () => ({
      apiVariant: "current" as const,
      records: [{ plcyNo: "P-1", plcyNm: "청년 지원" }],
      pagesFetched: 1,
      reportedTotal: 1,
      requestCount: 2,
    }),
    preparePolicies: () => ({
      mapped: [policy()],
      unique: [policy()],
      parseFailureCount: 0,
      dateParseFailureCount: 0,
      internalDuplicateCount: 0,
      fieldMissing: new Map<string, number>(),
    }),
    assertSchemaReady: async () => {},
    ensureSource: async () => ({ sourceId: 6, created: false }),
    loadExisting: async () =>
      existingKeys.map((sourceKey) => ({
        sourceKey,
        applyStart: null,
        applyEnd: null,
      })),
    buildPlan: buildYouthCenterSyncPlan,
    storePlan: async (
      _sourceId: number,
      sourceCreated: boolean,
      plan: ReturnType<typeof buildYouthCenterSyncPlan>,
    ) => ({
      sourceCreated,
      activeUpserted: plan.activeUpserts.length,
      closedUpdated: plan.closedUpdates.length,
      closedWithoutEndDate: plan.closedWithoutEndDate.length,
      absentExistingRowsUntouched: plan.absentExistingRowsUntouched,
      writeRequests: 2,
    }),
    nowMs: () => ++clock,
  };
}

function policy(): YouthCenterPolicy {
  return {
    sourceExternalId: "P-1",
    title: "청년 지원",
    summary: "청년에게 신청 가능한 지원을 제공합니다.",
    detailContent: null,
    organization: "테스트 기관",
    managingOrganization: null,
    region: "서울",
    regions: ["서울"],
    regionResolution: "single",
    target: "청년",
    supportType: "교육",
    applyStart: null,
    applyEnd: null,
    dateMode: "ongoing",
    status: "ongoing",
    sourceStatus: "always",
    originalUrl: "https://example.com/policy",
    applicationUrl: null,
    ageMin: 19,
    ageMax: 39,
    incomeCondition: null,
    educationCondition: null,
    employmentCondition: null,
    majorCondition: null,
    specialtyCondition: null,
    policyDomain: "education_training",
    sourceUpdatedAt: null,
    included: true,
    inclusionReason: "test",
    raw: { plcyNo: "P-1" },
  };
}

function sequenceFetch(responses: Response[]) {
  let index = 0;
  return (async () => {
    const response = responses[index++];
    if (!response) throw new Error("unexpected fetch");
    return response;
  }) as typeof fetch;
}

function xmlPage(count: number, total: number) {
  const records = Array.from({ length: count }, (_value, index) => `
    <item>
      <plcyNo>P-${index + 1}</plcyNo>
      <plcyNm>청년 지원 ${index + 1}</plcyNm>
    </item>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
    <response><totalCount>${total}</totalCount><items>${records}</items></response>`;
}
