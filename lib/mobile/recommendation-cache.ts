import type { NativeUserCondition } from "./app-bridge";
import type { OpenAnnouncementsSort } from "./open-announcements";
import type { RecommendationResult } from "./recommendations";
import type { StorageLike } from "./user-condition";

const CACHE_SCHEMA_VERSION = 1;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const RECOMMENDATION_CACHE_STORAGE_KEY =
  "govsupport:recommendations-cache:v1";

export interface RecommendationCacheValue {
  serverVersion: string | null;
  items: RecommendationResult[];
  pending: RecommendationResult[];
  page: number;
  hasMoreCandidates: boolean;
}

interface StoredRecommendationCache extends RecommendationCacheValue {
  schemaVersion: number;
  key: string;
  cachedAt: number;
}

export function buildRecommendationCacheKey(input: {
  condition: NativeUserCondition;
  sort: OpenAnnouncementsSort;
  includeNationwide: boolean;
}) {
  const { condition, sort, includeNationwide } = input;
  return JSON.stringify({
    userType: condition.user_type,
    region: condition.region,
    industry: condition.industry,
    interests: [...condition.interests].sort(),
    startupYears: condition.startup_years,
    schemaVersion: condition.schema_version,
    sort,
    includeNationwide,
  });
}

export function readRecommendationCache(
  expectedKey: string,
  storage: StorageLike | null = browserStorage(),
  now = Date.now(),
): RecommendationCacheValue | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RECOMMENDATION_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      !isStoredCache(parsed) ||
      parsed.key !== expectedKey ||
      now - parsed.cachedAt > CACHE_MAX_AGE_MS
    ) {
      return null;
    }
    return {
      serverVersion: parsed.serverVersion,
      items: parsed.items,
      pending: parsed.pending,
      page: parsed.page,
      hasMoreCandidates: parsed.hasMoreCandidates,
    };
  } catch {
    return null;
  }
}

export function writeRecommendationCache(
  key: string,
  value: RecommendationCacheValue,
  storage: StorageLike | null = browserStorage(),
  now = Date.now(),
) {
  if (!storage) return false;
  try {
    const stored: StoredRecommendationCache = {
      schemaVersion: CACHE_SCHEMA_VERSION,
      key,
      cachedAt: now,
      ...value,
    };
    storage.setItem(RECOMMENDATION_CACHE_STORAGE_KEY, JSON.stringify(stored));
    return true;
  } catch {
    return false;
  }
}

export function clearRecommendationCache(
  storage: StorageLike | null = browserStorage(),
) {
  if (!storage) return false;
  try {
    storage.removeItem(RECOMMENDATION_CACHE_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

function isStoredCache(value: unknown): value is StoredRecommendationCache {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === CACHE_SCHEMA_VERSION &&
    typeof value.key === "string" &&
    typeof value.cachedAt === "number" &&
    Number.isFinite(value.cachedAt) &&
    (value.serverVersion === null ||
      typeof value.serverVersion === "string") &&
    Array.isArray(value.items) &&
    value.items.every(isRecommendationResult) &&
    Array.isArray(value.pending) &&
    value.pending.every(isRecommendationResult) &&
    Number.isInteger(value.page) &&
    value.page >= 0 &&
    typeof value.hasMoreCandidates === "boolean"
  );
}

function isRecommendationResult(value: unknown) {
  if (!isRecord(value) || !isRecord(value.announcement)) return false;
  const announcement = value.announcement;
  return (
    Number.isSafeInteger(announcement.id) &&
    typeof announcement.title === "string" &&
    announcement.status === "open" &&
    Array.isArray(announcement.category_ids) &&
    announcement.category_ids.every(Number.isSafeInteger) &&
    typeof announcement.detail_url === "string" &&
    Array.isArray(value.matchedCategoryIds) &&
    value.matchedCategoryIds.every(Number.isSafeInteger) &&
    Array.isArray(value.reasons) &&
    value.reasons.every((reason) => typeof reason === "string") &&
    typeof value.needsAdditionalReview === "boolean"
  );
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
