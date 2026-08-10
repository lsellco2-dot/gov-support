import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGrantAnalysisResponse } from "@/lib/admin/ai-analysis/classification";
import { validateEligibility } from "@/lib/admin/ai-analysis/eligibility-validator";
import type {
  EligibilityDimension,
  EligibilityValidation,
} from "@/lib/admin/ai-analysis/eligibility-types";
import type {
  GrantAnalysisCandidate,
  GrantAnalysisInput,
  GrantAnalysisResponse,
} from "@/lib/admin/ai-analysis/types";

const baseProfile: GrantAnalysisInput["profile"] = {
  user_type: "pre_startup",
  region: "seoul",
  industry: "all",
  interests: ["startup_support"],
  startup_years: "pre_startup",
  onboarding_completed: true,
  schema_version: 1,
  birth_year: null,
  employment_status: "",
  youth_policy_interests: [],
  business_item_description: "가상 서비스",
  needed_support: "사업화자금",
};

test("CASE 1: prospective founder mismatches an existing-business-only grant", () => {
  const grant = candidate({ target: "기존 사업자만 신청 가능" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "startupStatus"), "MISMATCH");
  assert.equal(normalizedClass(baseProfile, grant, "EXCLUDE"), "EXCLUDE");
});

test("CASE 2: missing gender is UNKNOWN for a women-only grant", () => {
  const grant = candidate({ target: "여성 창업자만 신청 가능" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "gender"), "UNKNOWN");
  const result = normalized(baseProfile, grant, "EXCLUDE");
  assert.equal(result.classification, "B");
  assert.equal(result.requiresVerification, true);
});

test("CASE 3: explicit male profile mismatches a women-only grant", () => {
  const profile = { ...baseProfile, gender: "male" };
  const grant = candidate({ target: "여성 창업자만 신청 가능" });
  assert.equal(status(validateEligibility(profile, grant), "gender"), "MISMATCH");
  assert.equal(normalizedClass(profile, grant, "EXCLUDE"), "EXCLUDE");
});

test("female prospective-founder wording creates both gender and startup requirements", () => {
  const grant = candidate({ target: "여성 (예비)창업자 대상" });
  const missingGender = validateEligibility(baseProfile, grant);
  assert.equal(status(missingGender, "gender"), "UNKNOWN");
  assert.equal(status(missingGender, "startupStatus"), "MATCH");
  assert.equal(normalizedClass(baseProfile, grant, "EXCLUDE"), "B");

  const femaleProfile = { ...baseProfile, gender: "female" };
  assert.equal(
    status(validateEligibility(femaleProfile, grant), "gender"),
    "MATCH",
  );
});

test("women CEO applicant wording requires an existing business", () => {
  const grant = candidate({ target: "여성 CEO 대상" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "gender"), "UNKNOWN");
  assert.equal(status(validation, "startupStatus"), "MISMATCH");
  assert.equal(normalizedClass(baseProfile, grant, "B"), "EXCLUDE");
});

test("prospective women CEO development does not become existing-only", () => {
  const grant = candidate({ target: "예비 여성 CEO 육성 프로그램" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "gender"), "UNKNOWN");
  assert.equal(status(validation, "startupStatus"), "MATCH");
  assert.notEqual(validation.announcement.startupStatus.value, "EXISTING_ONLY");
});

test("preferred gender wording cannot exclude a profile", () => {
  const grant = candidate({ target: "여성 창업자 우대" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "gender"), "UNKNOWN");
  assert.equal(comparison(validation, "gender")?.strength, "PREFERRED");
  assert.equal(
    validation.unknown.some(({ dimension }) => dimension === "gender"),
    false,
  );
  assert.equal(normalizedClass(baseProfile, grant, "EXCLUDE"), "B");
});

test("CASE 4: missing education is UNKNOWN for a graduate-only grant", () => {
  const grant = candidate({
    target: "석사 또는 박사 학위 보유자",
    educationCondition: "석박사 대상",
  });
  assert.equal(
    status(validateEligibility(baseProfile, grant), "education"),
    "UNKNOWN",
  );
  assert.equal(normalizedClass(baseProfile, grant, "EXCLUDE"), "B");
});

test("CASE 5: prospective founder matches a prospective-founder grant", () => {
  const grant = candidate({ target: "예비창업자 대상" });
  assert.equal(
    status(validateEligibility(baseProfile, grant), "startupStatus"),
    "MATCH",
  );
});

test("prospective founder matches a grant that also accepts young businesses", () => {
  const grant = candidate({
    target: "예비창업자 및 창업 3년 이내 기업",
  });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "startupStatus"), "MATCH");
  assert.equal(status(validation, "startupYears"), "NOT_APPLICABLE");
  assert.equal(validation.mismatch.length, 0);
});

test("CASE 11: prospective and early-stage connector variants allow prospective founders", () => {
  for (const target of [
    "예비 및 초기창업자",
    "(예비)창업자 및 초기창업기업",
    "예비·초기창업자",
    "예비/초기창업자",
    "예비 또는 초기창업자",
    "예비창업자 및 초기창업자",
    "예비창업자 및 초기창업기업",
    "예비창업자, 초기창업자",
    "예비창업자, 초기창업기업",
  ]) {
    const validation = validateEligibility(baseProfile, candidate({ target }));
    assert.equal(status(validation, "startupStatus"), "MATCH", target);
    assert.equal(validation.mismatch.length, 0, target);
  }
});

test("CASE 12: explicit prospective-founder exclusions remain required mismatches", () => {
  for (const target of [
    "예비창업자 제외",
    "예비창업자는 신청 불가",
    "사업자등록을 완료한 기업만 신청 가능",
    "기존 사업자에 한함",
    "창업기업만 신청 가능",
  ]) {
    const grant = candidate({ target });
    const validation = validateEligibility(baseProfile, grant);
    assert.equal(status(validation, "startupStatus"), "MISMATCH", target);
    assert.equal(normalizedClass(baseProfile, grant, "B"), "EXCLUDE", target);
  }
});

test("CASE 13: preferred education does not become a required unknown", () => {
  const grant = candidate({ target: "석사 이상 우대" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "education"), "UNKNOWN");
  assert.equal(comparison(validation, "education")?.strength, "PREFERRED");
  assert.equal(
    validation.unknown.some(({ dimension }) => dimension === "education"),
    false,
  );
  assert.equal(normalizedClass(baseProfile, grant, "EXCLUDE"), "B");
});

test("CASE 14: required education with missing profile data requires review", () => {
  const grant = candidate({ target: "석사 이상 필수" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "education"), "UNKNOWN");
  assert.equal(comparison(validation, "education")?.strength, "REQUIRED");
  const result = normalized(baseProfile, grant, "EXCLUDE");
  assert.equal(result.classification, "B");
  assert.ok(result.missingConditions.includes("학위 확인 필요"));
});

test("CASE 15: preferred major never excludes a profile with no major", () => {
  const grant = candidate({ target: "AI 전공자 가점" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "major"), "UNKNOWN");
  assert.equal(comparison(validation, "major")?.strength, "PREFERRED");
  assert.equal(
    validation.unknown.some(({ dimension }) => dimension === "major"),
    false,
  );
  assert.equal(normalizedClass(baseProfile, grant, "EXCLUDE"), "B");
});

test("CASE 16: a required major can produce a clear mismatch", () => {
  const profile = { ...baseProfile, major: "경영학" };
  const grant = candidate({ target: "AI 전공자만 지원 가능" });
  const validation = validateEligibility(profile, grant);
  assert.equal(status(validation, "major"), "MISMATCH");
  assert.equal(comparison(validation, "major")?.strength, "REQUIRED");
  assert.equal(normalizedClass(profile, grant, "B"), "EXCLUDE");
});

test("CASE 17: a preferred early-stage clause does not override required prospective eligibility", () => {
  const grant = candidate({
    target: "예비창업자 및 초기창업기업\n우대사항: 초기창업기업",
  });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "startupStatus"), "MATCH");
  assert.equal(comparison(validation, "startupStatus")?.strength, "REQUIRED");
  assert.equal(validation.mismatch.length, 0);
});

test("CASE 18: preferred-only early businesses cannot exclude prospective founders", () => {
  const grant = candidate({ target: "초기창업기업 우대" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "startupStatus"), "MISMATCH");
  assert.equal(comparison(validation, "startupStatus")?.strength, "PREFERRED");
  assert.equal(validation.mismatch.length, 0);
  assert.equal(normalizedClass(baseProfile, grant, "B"), "B");
});

test("regression 37817: connected prospective and early-stage wording is not existing-only", () => {
  const grant = candidate({
    id: 37817,
    target: "청년 예비 및 초기창업자(1987년 이후 출생자)",
  });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "startupStatus"), "MATCH");
  assert.equal(validation.announcement.age.state, "KNOWN");
  assert.equal(status(validation, "age"), "UNKNOWN");
  assert.notEqual(validation.announcement.startupStatus.value, "EXISTING_ONLY");
});

test("birth-year eligibility expressions produce bounded age requirements", () => {
  const bornAfter = validateEligibility(
    baseProfile,
    candidate({ target: "1987년 이후 출생자" }),
  );
  assert.equal(bornAfter.announcement.age.state, "KNOWN");
  assert.equal(status(bornAfter, "age"), "UNKNOWN");

  const bornRange = validateEligibility(
    { ...baseProfile, birth_year: 1990 },
    candidate({ target: "1987~2007년 출생자" }),
  );
  assert.equal(bornRange.announcement.age.state, "KNOWN");
  assert.equal(status(bornRange, "age"), "MATCH");
});

test("regression 36448: women CEO applicant wording remains existing-only", () => {
  const grant = candidate({
    id: 36448,
    target: "기업의 성장을 고민하는 여성CEO 대상",
  });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "gender"), "UNKNOWN");
  assert.equal(status(validation, "startupStatus"), "MISMATCH");
  assert.equal(validation.announcement.startupStatus.value, "EXISTING_ONLY");
});

test("regression 25635: parenthesized female prospective condition is recognized", () => {
  const grant = candidate({ id: 25635, target: "여성 (예비)창업자 대상" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "gender"), "UNKNOWN");
  assert.equal(status(validation, "startupStatus"), "MATCH");
});

test("regression 35132: parenthesized prospective founder wording is allowed", () => {
  const grant = candidate({
    id: 35132,
    target:
      "이공계(예비)석·박사급 연구인력, 기술사업화 분야 (예비)창업자·초기창업자",
  });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "startupStatus"), "MATCH");
  assert.notEqual(validation.announcement.startupStatus.value, "EXISTING_ONLY");
  assert.equal(normalizedClass(baseProfile, grant, "EXCLUDE"), "B");
});

test("CASE 6: province-only profile leaves a district requirement UNKNOWN", () => {
  const grant = candidate({ target: "구로구 거주자 필수" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(status(validation, "regionProvince"), "MATCH");
  assert.equal(status(validation, "regionDistrict"), "UNKNOWN");
  assert.equal(normalizedClass(baseProfile, grant, "EXCLUDE"), "B");
});

test("CASE 7: a different known district is a clear MISMATCH", () => {
  const profile = { ...baseProfile, region_district: "강남구" };
  const grant = candidate({ target: "구로구 거주자 필수" });
  assert.equal(
    status(validateEligibility(profile, grant), "regionDistrict"),
    "MISMATCH",
  );
  assert.equal(normalizedClass(profile, grant, "EXCLUDE"), "EXCLUDE");
});

test("CASE 8: region metadata does not create an eligibility requirement", () => {
  const grant = candidate({
    region: "서울",
    regions: ["서울"],
    target: "예비창업자 대상",
  });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(validation.announcement.regionProvince.state, "NOT_APPLICABLE");
  assert.equal(validation.announcement.regionDistrict.state, "NOT_APPLICABLE");
});

test("CASE 9: an LLM-created district condition is not adopted as a fact", () => {
  const grant = candidate({ target: "예비창업자 대상" });
  const validation = validateEligibility(baseProfile, grant);
  assert.equal(validation.announcement.regionDistrict.state, "NOT_APPLICABLE");
  const result = normalized(baseProfile, grant, "EXCLUDE", {
    reasons: ["강남구 소재가 필수이므로 제외합니다."],
    evidence: ["강남구 소재 필수"],
  });
  assert.equal(result.classification, "B");
  assert.ok(result.safetyRules?.includes("eligibility_unverified_exclude_to_b"));
});

test("CASE 10: a clear existing-business exclusion is never softened to B", () => {
  const grant = candidate({
    target: "기존 사업자만 신청 가능하며 예비창업자는 제외",
  });
  const result = normalized(baseProfile, grant, "EXCLUDE");
  assert.equal(result.classification, "EXCLUDE");
  assert.ok(result.safetyRules?.includes("eligibility_mismatch_enforced"));
});

test("existing-business-only regression fixtures remain mismatches", () => {
  for (const [id, target] of [
    [838, "사업자등록을 완료한 기업만 신청 가능"],
    [1049, "기존 사업자에 한함"],
    [1557, "창업기업만 신청 가능"],
    [1555, "법인 또는 개인사업자 대표 대상"],
  ] as const) {
    const grant = candidate({ id, target });
    const validation = validateEligibility(baseProfile, grant);
    assert.equal(status(validation, "startupStatus"), "MISMATCH", String(id));
    assert.equal(normalizedClass(baseProfile, grant, "B"), "EXCLUDE");
  }
});

function status(
  validation: EligibilityValidation,
  dimension: EligibilityDimension,
) {
  return comparison(validation, dimension)?.status;
}

function comparison(
  validation: EligibilityValidation,
  dimension: EligibilityDimension,
) {
  return validation.comparisons.find((item) => item.dimension === dimension);
}

function normalizedClass(
  profile: GrantAnalysisInput["profile"],
  grant: GrantAnalysisCandidate,
  classification: "A" | "B" | "C" | "EXCLUDE",
) {
  return normalized(profile, grant, classification).classification;
}

function normalized(
  profile: GrantAnalysisInput["profile"],
  grant: GrantAnalysisCandidate,
  classification: "A" | "B" | "C" | "EXCLUDE",
  overrides: Partial<GrantAnalysisResponse["results"][number]> = {},
) {
  const input: GrantAnalysisInput = {
    profile,
    businessItemDescription: profile.business_item_description,
    neededSupport: profile.needed_support,
    candidates: [grant],
  };
  const response: GrantAnalysisResponse = {
    provider: "gemini",
    model: "test",
    billingTier: "free",
    inputTokens: 1,
    outputTokens: 1,
    thinkingTokens: 0,
    totalTokens: 2,
    durationMs: 1,
    totalDurationMs: 1,
    estimatedCost: { amount: 0, currency: "USD" },
    apiCalls: 1,
    results: [
      {
        announcementId: grant.id,
        classification,
        confidence: 0.9,
        reasons: ["공고와 사용자 조건을 비교했습니다."],
        evidence: [grant.target ?? "공고 지원대상"],
        missingConditions: [],
        cautions: [],
        requiresVerification: false,
        ...overrides,
      },
    ],
  };
  return normalizeGrantAnalysisResponse(input, response).results[0];
}

function candidate(
  overrides: Partial<GrantAnalysisCandidate> = {},
): GrantAnalysisCandidate {
  return {
    id: 1,
    title: "가상 공고",
    source: "kstartup",
    source_name: "K-Startup",
    agency: "테스트 기관",
    region: null,
    regions: null,
    apply_start: "2026-08-01",
    apply_end: "2026-08-31",
    status: "open",
    score: 3,
    reasons: ["관심 분야 일치"],
    category_ids: [1],
    category_names: ["창업지원"],
    policy_domain: null,
    policy_domain_label: null,
    detail_url: "/announcements/1",
    original_url: "https://example.com/1",
    target: "예비창업자 대상",
    supportType: "사업화 자금",
    summary: "가상 공고 요약",
    detailContent: null,
    applyMethod: "온라인 신청",
    documents: "사업계획서",
    age_min: null,
    age_max: null,
    educationCondition: null,
    employmentCondition: null,
    majorCondition: null,
    contentTruncated: false,
    ...overrides,
  };
}
