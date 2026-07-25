import { fetchAllYouthCenterPolicies } from "./client";
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
}

interface YouthCenterIngestDependencies {
  fetchPolicies: typeof fetchAllYouthCenterPolicies;
  preparePolicies: typeof prepareYouthCenterPolicies;
  assertSchemaReady: typeof assertYouthCenterSchemaReady;
  ensureSource: typeof ensureYouthCenterSource;
  loadExisting: typeof loadExistingYouthCenterAnnouncements;
  buildPlan: typeof buildYouthCenterSyncPlan;
  storePlan: typeof storeYouthCenterPlan;
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
    dbWriteCount: stored.writeRequests + (source.created ? 1 : 0),
    fetchDurationMs,
    transformDurationMs,
    upsertDurationMs,
    parsed: prepared.mapped.length,
    parseFailures: prepared.parseFailureCount,
    activeTargets: plan.activeUpserts.length,
    sourceCreated: source.created,
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
