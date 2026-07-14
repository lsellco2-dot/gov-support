import assert from "node:assert/strict";
import test from "node:test";
import type { NativeUserCondition } from "./app-bridge";
import {
  evaluateRecommendation,
  filterNationwideRecommendations,
  INTEREST_CATEGORY_IDS,
  isNationwideUserRegion,
  matchRecommendations,
  type OpenAnnouncement,
} from "./recommendations";

const condition: NativeUserCondition = {
  user_type: "small_business",
  region: "seoul",
  industry: "retail",
  interests: ["finance_loan_guarantee"],
  startup_years: "years_1_3",
  onboarding_completed: true,
  schema_version: 1,
};

const announcement: OpenAnnouncement = {
  id: 1,
  title: "서울 소상공인 자금 지원",
  agency: "서울시",
  category_ids: [3],
  region: "서울",
  target: "소상공인",
  support_type: "융자",
  status: "open",
  apply_start: "2026-07-01",
  apply_end: "2026-08-31",
  created_at: "2026-07-12T00:00:00.000Z",
  detail_url: "https://gov-support-nine.vercel.app/app/announcements/1",
  original_url: null,
};

test("interest mapping exactly matches Android category ids", () => {
  assert.deepEqual(INTEREST_CATEGORY_IDS, {
    startup_support: 1,
    small_business_support: 2,
    finance_loan_guarantee: 3,
    marketing_sales: 4,
    employment_labor_cost: 5,
    technology_rnd: 6,
    export_global: 7,
    education_consulting: 8,
    facility_digital: 9,
  });
});

test("matches open announcement by category region and target", () => {
  const result = evaluateRecommendation(condition, announcement);
  assert.ok(result);
  assert.deepEqual(result.matchedCategoryIds, [3]);
  assert.deepEqual(result.reasons, ["관심 분야 일치", "지역 일치"]);
  assert.equal(result.needsAdditionalReview, false);
});

test("allows nationwide and treats missing region or target as additional review", () => {
  const nationwide = evaluateRecommendation(condition, { ...announcement, region: "전국" });
  assert.ok(nationwide);

  const unknown = evaluateRecommendation(condition, {
    ...announcement,
    region: null,
    target: null,
  });
  assert.ok(unknown);
  assert.equal(unknown.needsAdditionalReview, true);
  assert.deepEqual(unknown.reasons, [
    "관심 분야 일치",
    "지역 확인 필요",
    "지원대상 확인 필요",
  ]);
});

test("excludes category region target conflicts and closed announcements", () => {
  assert.equal(
    evaluateRecommendation(condition, { ...announcement, category_ids: [1] }),
    null,
  );
  assert.equal(
    evaluateRecommendation(condition, { ...announcement, region: "부산" }),
    null,
  );
  assert.equal(
    evaluateRecommendation(condition, { ...announcement, target: "구직자 및 재직자" }),
    null,
  );
  assert.equal(
    evaluateRecommendation(condition, { ...announcement, status: "closed" as "open" }),
    null,
  );
});

test("Seoul user can include or exclude nationwide announcements", () => {
  const recommendations = matchRecommendations(condition, [
    { ...announcement, id: 1, region: "서울" },
    { ...announcement, id: 2, region: "전국" },
    { ...announcement, id: 3, region: null },
  ]);

  assert.deepEqual(
    filterNationwideRecommendations(recommendations, "seoul", true).map(
      ({ announcement: item }) => item.id,
    ),
    [1, 2, 3],
  );
  assert.deepEqual(
    filterNationwideRecommendations(recommendations, "seoul", false).map(
      ({ announcement: item }) => item.id,
    ),
    [1, 3],
  );
});

test("nationwide users keep all matched regions and do not need the filter", () => {
  const nationwideCondition = { ...condition, region: "nationwide" };
  const recommendations = matchRecommendations(nationwideCondition, [
    { ...announcement, id: 1, region: "서울" },
    { ...announcement, id: 2, region: "전국" },
    { ...announcement, id: 3, region: "부산" },
  ]);

  assert.equal(isNationwideUserRegion("nationwide"), true);
  assert.equal(isNationwideUserRegion("전국"), true);
  assert.deepEqual(
    filterNationwideRecommendations(recommendations, "nationwide", false).map(
      ({ announcement: item }) => item.id,
    ),
    [1, 2, 3],
  );
});

test("applies the same nationwide filter to later pages and preserves unknown regions", () => {
  const firstPage = matchRecommendations(condition, [
    { ...announcement, id: 1, region: "서울" },
    { ...announcement, id: 2, region: "전국" },
  ]);
  const secondPage = matchRecommendations(condition, [
    { ...announcement, id: 3, region: null },
    { ...announcement, id: 4, region: "nationwide" },
  ]);

  const ids = [...firstPage, ...secondPage].flatMap((item) =>
    filterNationwideRecommendations([item], condition.region, false).map(
      ({ announcement: filtered }) => filtered.id,
    ),
  );
  assert.deepEqual(ids, [1, 3]);
});
