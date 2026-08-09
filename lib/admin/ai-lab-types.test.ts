import assert from "node:assert/strict";
import test from "node:test";
import {
  parseAiLabSearchInput,
  sortAiLabCandidates,
  type AiLabCandidate,
} from "./ai-lab-types";

const validInput = {
  profile: {
    user_type: "small_business",
    region: "seoul",
    industry: "retail",
    interests: ["finance_loan_guarantee"],
    startup_years: "years_1_3",
    birth_year: 1990,
    employment_status: "",
    youth_policy_interests: ["finance_welfare_culture"],
    business_item_description: "지역 식품 브랜드",
    needed_support: "사업화자금",
  },
  include_nationwide: false,
  candidate_limit: 20,
  sort: "score",
};

test("AI lab input reuses profile enums and preserves future LLM text", () => {
  const parsed = parseAiLabSearchInput(validInput);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.profile.business_item_description, "지역 식품 브랜드");
  assert.equal(parsed.value.profile.needed_support, "사업화자금");
  assert.equal(parsed.value.candidate_limit, 20);
});

test("AI lab accepts only supported candidate limits and profile codes", () => {
  for (const limit of [10, 20, 30, 50]) {
    assert.equal(parseAiLabSearchInput({ ...validInput, candidate_limit: limit }).ok, true);
  }
  assert.equal(parseAiLabSearchInput({ ...validInput, candidate_limit: 40 }).ok, false);
  assert.equal(
    parseAiLabSearchInput({
      ...validInput,
      profile: { ...validInput.profile, region: "unsupported" },
    }).ok,
    false,
  );
});

test("AI lab accepts the existing target user types and regional profile codes", () => {
  for (const userType of [
    "pre_startup",
    "small_business",
    "sme",
    "job_seeker_worker",
  ]) {
    for (const region of ["seoul", "gyeonggi", "gwangju", "jeonnam"]) {
      assert.equal(
        parseAiLabSearchInput({
          ...validInput,
          profile: { ...validInput.profile, user_type: userType, region },
        }).ok,
        true,
      );
    }
  }
});

test("worker profiles use the existing not-applicable startup year", () => {
  const parsed = parseAiLabSearchInput({
    ...validInput,
    profile: { ...validInput.profile, user_type: "job_seeker_worker" },
  });
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.profile.startup_years, "not_applicable");
});

test("candidate ordering supports score and deadline views", () => {
  const base: AiLabCandidate = {
    id: 1,
    title: "공고",
    source: "bizinfo",
    source_name: "기업마당",
    agency: null,
    region: "서울",
    regions: null,
    apply_start: null,
    apply_end: "2026-09-01",
    status: "open",
    score: 2,
    reasons: [],
    category_ids: [1],
    category_names: ["창업지원"],
    policy_domain: null,
    policy_domain_label: null,
    detail_url: "/announcements/1",
    original_url: null,
  };
  const candidates = [
    base,
    { ...base, id: 2, score: 3, apply_end: "2026-10-01" },
    { ...base, id: 3, score: 2, apply_end: "2026-08-20" },
  ];
  assert.deepEqual(sortAiLabCandidates(candidates, "score").map(({ id }) => id), [2, 3, 1]);
  assert.deepEqual(sortAiLabCandidates(candidates, "deadline").map(({ id }) => id), [3, 1, 2]);
});
