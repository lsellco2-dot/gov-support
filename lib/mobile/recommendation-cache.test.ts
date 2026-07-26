import assert from "node:assert/strict";
import test from "node:test";
import type { NativeUserCondition } from "./app-bridge";
import {
  buildRecommendationCacheKey,
  clearRecommendationCache,
  readRecommendationCache,
  RECOMMENDATION_CACHE_STORAGE_KEY,
  writeRecommendationCache,
} from "./recommendation-cache";
import type { RecommendationResult } from "./recommendations";
import type { StorageLike } from "./user-condition";

const condition: NativeUserCondition = {
  user_type: "small_business",
  region: "seoul",
  industry: "retail",
  interests: ["finance_loan_guarantee", "startup_support"],
  startup_years: "years_1_3",
  onboarding_completed: true,
  schema_version: 1,
};

test("cache key changes with recommendation inputs but not interest order", () => {
  const base = buildRecommendationCacheKey({
    condition,
    sort: "latest",
    includeNationwide: false,
  });
  assert.equal(
    base,
    buildRecommendationCacheKey({
      condition: {
        ...condition,
        interests: [...condition.interests].reverse(),
      },
      sort: "latest",
      includeNationwide: false,
    }),
  );
  assert.notEqual(
    base,
    buildRecommendationCacheKey({
      condition,
      sort: "deadline",
      includeNationwide: false,
    }),
  );
  assert.notEqual(
    base,
    buildRecommendationCacheKey({
      condition,
      sort: "latest",
      includeNationwide: true,
    }),
  );
});

test("stores and restores a valid recommendation result", () => {
  const storage = memoryStorage();
  const key = buildRecommendationCacheKey({
    condition,
    sort: "latest",
    includeNationwide: false,
  });
  const value = {
    serverVersion: "2026-07-26:100:20",
    items: [recommendation(1)],
    pending: [recommendation(2)],
    page: 1,
    hasMoreCandidates: true,
  };

  assert.equal(writeRecommendationCache(key, value, storage, 1_000), true);
  assert.deepEqual(readRecommendationCache(key, storage, 2_000), value);
});

test("keeps nationwide filter variants without overwriting either cache", () => {
  const storage = memoryStorage();
  const excludedKey = buildRecommendationCacheKey({
    condition,
    sort: "latest",
    includeNationwide: false,
  });
  const includedKey = buildRecommendationCacheKey({
    condition,
    sort: "latest",
    includeNationwide: true,
  });
  const excludedValue = {
    serverVersion: "2026-07-26:100:20",
    items: [recommendation(1)],
    pending: [],
    page: 1,
    hasMoreCandidates: true,
  };
  const includedValue = {
    serverVersion: "2026-07-26:100:20",
    items: [recommendation(1), recommendation(2)],
    pending: [recommendation(3)],
    page: 1,
    hasMoreCandidates: true,
  };

  writeRecommendationCache(excludedKey, excludedValue, storage, 1_000);
  writeRecommendationCache(includedKey, includedValue, storage, 2_000);

  assert.deepEqual(
    readRecommendationCache(excludedKey, storage, 3_000),
    excludedValue,
  );
  assert.deepEqual(
    readRecommendationCache(includedKey, storage, 3_000),
    includedValue,
  );
});

test("rejects stale, mismatched, and damaged cache data", () => {
  const storage = memoryStorage();
  const key = buildRecommendationCacheKey({
    condition,
    sort: "latest",
    includeNationwide: false,
  });
  const value = {
    serverVersion: null,
    items: [recommendation(1)],
    pending: [],
    page: 1,
    hasMoreCandidates: false,
  };
  writeRecommendationCache(key, value, storage, 1_000);

  assert.equal(readRecommendationCache("different", storage, 2_000), null);
  assert.equal(
    readRecommendationCache(key, storage, 8 * 24 * 60 * 60 * 1000),
    null,
  );
  storage.setItem(RECOMMENDATION_CACHE_STORAGE_KEY, "{broken");
  assert.equal(readRecommendationCache(key, storage, 2_000), null);
});

test("clears the stored recommendation cache", () => {
  const storage = memoryStorage();
  storage.setItem(RECOMMENDATION_CACHE_STORAGE_KEY, "{}");
  assert.equal(clearRecommendationCache(storage), true);
  assert.equal(storage.getItem(RECOMMENDATION_CACHE_STORAGE_KEY), null);
});

function recommendation(id: number): RecommendationResult {
  return {
    announcement: {
      id,
      source: "bizinfo",
      title: `공고 ${id}`,
      agency: "기관",
      category_ids: [1],
      region: "서울",
      target: "소상공인",
      support_type: "사업화",
      status: "open",
      apply_start: "2026-07-01",
      apply_end: "2026-08-31",
      created_at: "2026-07-26T00:00:00.000Z",
      detail_url: `/app/announcements/${id}`,
      original_url: null,
    },
    matchedCategoryIds: [1],
    reasons: ["관심 분야 일치"],
    needsAdditionalReview: false,
  };
}

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
