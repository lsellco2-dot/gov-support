import { fetchAllYouthCenterPolicies } from "./client";
import {
  fetchAndStoreYouthCenterDetails,
  loadYouthCenterDetailCandidates,
} from "./detail-store";
import { prepareYouthCenterPolicies } from "./prepare";
import {
  assertYouthCenterSchemaReady,
  buildYouthCenterSyncPlan,
  ensureYouthCenterSource,
  loadExistingYouthCenterAnnouncements,
  storeYouthCenterPlan,
} from "./store";
import type { YouthCenterFetchResult } from "./types";

export type YouthCenterIngestErrorCode =
  | "MISSING_API_KEY"
  | "FETCH_FAILED"
  | "SCHEMA_NOT_READY"
  | "SOURCE_FAILED"
  | "LOAD_EXISTING_FAILED"
  | "STORE_FAILED"
  | "UNKNOWN";

export class YouthCenterIngestError extends Error {
  constructor(
    public readonly code: YouthCenterIngestErrorCode,
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = "YouthCenterIngestError";
  }
}

export interface YouthCenterIngestReport {
  source: "youthcenter";
  success: true;
  fetched: number;
  inserted: number;
  updated: number;
  closedSynced: number;
  durationMs: number;
  errorCode: null;
  apiVariant: YouthCenterFetchResult["apiVariant"];
  pagesFetched: number;
  apiCallCount: number;
  dbWriteCount: number;
  fetchDurationMs: number;
  transformDurationMs: number;
  upsertDurationMs: number;
  parsed: number;
  parseFailures: number;
  activeTargets: number;
  sourceCreated: boolean;
  detailsFetched: number;
  detailsFailed: number;
  detailsPending: number;
}

interface YouthCenterIngestDependencies {
  fetchPolicies: typeof fetchAllYouthCenterPolicies;
  preparePolicies: typeof prepareYouthCenterPolicies;
  assertSchemaReady: typeof assertYouthCenterSchemaReady;
  ensureSource: typeof ensureYouthCenterSource;
  loadExisting: typeof loadExistingYouthCenterAnnouncements;
  buildPlan: typeof buildYouthCenterSyncPlan;
  storePlan: typeof storeYouthCenterPlan;
  loadDetailCandidates: typeof loadYouthCenterDetailCandidates;
  storeDetails: typeof fetchAndStoreYouthCenterDetails;
  nowMs: () => number;
}

export interface RunYouthCenterIngestOptions {
  apiKey?: string;
  dependencies?: Partial<YouthCenterIngestDependencies>;
}

const productionDependencies: YouthCenterIngestDependencies = {
  fetchPolicies: fetchAllYouthCenterPolicies,
  preparePolicies: prepareYouthCenterPolicies,
  assertSchemaReady: assertYouthCenterSchemaReady,
  ensureSource: ensureYouthCenterSource,
  loadExisting: loadExistingYouthCenterAnnouncements,
  buildPlan: buildYouthCenterSyncPlan,
  storePlan: storeYouthCenterPlan,
  loadDetailCandidates: loadYouthCenterDetailCandidates,
  storeDetails: fetchAndStoreYouthCenterDetails,
  nowMs: () => Date.now(),
};

export async function runYouthCenterIngest(
  options: RunYouthCenterIngestOptions = {},
): Promise<YouthCenterIngestReport> {
  const dependencies = {
    ...productionDependencies,
    ...options.dependencies,
  };
  const startedAt = dependencies.nowMs();
  const apiKey = (options.apiKey ?? process.env.YOUTHCENTER_API_KEY)?.trim();
  if (!apiKey) throw new YouthCenterIngestError("MISSING_API_KEY");

  const fetchStartedAt = dependencies.nowMs();
  const fetched = await phase(
    "FETCH_FAILED",
    () => dependencies.fetchPolicies(apiKey),
  );
  const fetchDurationMs = elapsed(fetchStartedAt, dependencies.nowMs());

  const transformStartedAt = dependencies.nowMs();
  const prepared = dependencies.preparePolicies(fetched.records);
  const transformDurationMs = elapsed(transformStartedAt, dependencies.nowMs());

  await phase("SCHEMA_NOT_READY", () => dependencies.assertSchemaReady());
  const source = await phase("SOURCE_FAILED", () => dependencies.ensureSource());
  const existing = await phase(
    "LOAD_EXISTING_FAILED",
    () => dependencies.loadExisting(source.sourceId),
  );
  const existingKeys = new Set(existing.map((row) => row.sourceKey));
  const plan = dependencies.buildPlan(
    prepared.unique,
    existing,
    source.sourceId,
  );
  const inserted = plan.activeUpserts.filter(
    (row) => !existingKeys.has(row.source_key),
  ).length;
  const updated = plan.activeUpserts.length - inserted;

  const upsertStartedAt = dependencies.nowMs();
  const stored = await phase(
    "STORE_FAILED",
    () => dependencies.storePlan(source.sourceId, source.created, plan),
  );
  let detailsFetched = 0;
  let detailsFailed = 0;
  let detailsPending = 0;
  let detailWriteCount = 0;
  try {
    const selection = await dependencies.loadDetailCandidates(
      source.sourceId,
      { limit: detailFetchLimit() },
    );
    detailsPending = Math.max(
      0,
      selection.totalEligible - selection.candidates.length,
    );
    const detailResult = await dependencies.storeDetails(
      selection.candidates,
      source.sourceId,
    );
    detailsFetched = detailResult.fetched;
    detailsFailed = detailResult.failed;
    detailWriteCount = detailResult.writeCount;
  } catch (error) {
    console.error(
      "[youthcenter] 원문 수집 단계 실패:",
      error instanceof Error ? error.message : "unknown error",
    );
  }
  const upsertDurationMs = elapsed(upsertStartedAt, dependencies.nowMs());

  return {
    source: "youthcenter",
    success: true,
    fetched: fetched.records.length,
    inserted,
    updated,
    closedSynced: stored.closedUpdated,
    durationMs: elapsed(startedAt, dependencies.nowMs()),
    errorCode: null,
    apiVariant: fetched.apiVariant,
    pagesFetched: fetched.pagesFetched,
    apiCallCount: fetched.requestCount,
    dbWriteCount:
      stored.writeRequests +
      detailWriteCount +
      (source.created ? 1 : 0),
    fetchDurationMs,
    transformDurationMs,
    upsertDurationMs,
    parsed: prepared.mapped.length,
    parseFailures: prepared.parseFailureCount,
    activeTargets: plan.activeUpserts.length,
    sourceCreated: source.created,
    detailsFetched,
    detailsFailed,
    detailsPending,
  };
}

export function youthCenterIngestErrorCode(
  error: unknown,
): YouthCenterIngestErrorCode {
  return error instanceof YouthCenterIngestError ? error.code : "UNKNOWN";
}

async function phase<T>(
  code: YouthCenterIngestErrorCode,
  operation: () => Promise<T>,
) {
  try {
    return await operation();
  } catch (error) {
    throw new YouthCenterIngestError(code, { cause: error });
  }
}

function elapsed(startedAt: number, endedAt: number) {
  return Math.max(0, Math.round(endedAt - startedAt));
}

function detailFetchLimit() {
  const configured = Number(process.env.DETAIL_FETCH_LIMIT_PER_SOURCE ?? 8);
  if (!Number.isFinite(configured)) return 8;
  return Math.min(20, Math.max(0, Math.floor(configured)));
}
