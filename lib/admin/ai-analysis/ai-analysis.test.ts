import assert from "node:assert/strict";
import test from "node:test";
import { normalizeGrantAnalysisResponse } from "@/lib/admin/ai-analysis/classification";
import { validateEligibility } from "@/lib/admin/ai-analysis/eligibility-validator";
import { mockGrantAnalysisProvider } from "@/lib/admin/ai-analysis/mock-provider";
import {
  estimateGeminiCost,
  GEMINI_API_VERSION,
  GEMINI_PRICING,
} from "@/lib/admin/ai-analysis/gemini-runtime";
import {
  analyzeGrantCandidates,
  analyzeGrantCandidatesInBatches,
  GrantAnalysisBatchError,
  splitGrantAnalysisCandidates,
  type GrantAnalysisProvider,
} from "@/lib/admin/ai-analysis/provider";
import {
  parseGrantAnalysisRequest,
  type GrantAnalysisCandidate,
  type GrantAnalysisInput,
  type GrantAnalysisResponse,
} from "@/lib/admin/ai-analysis/types";
import {
  type AiLabProfile,
  type AiLabSearchInput,
} from "@/lib/admin/ai-lab-types";

const profile: AiLabProfile = {
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
  business_item_description: "지역 식품 서비스",
  needed_support: "사업화자금",
};

const search: AiLabSearchInput = {
  profile,
  include_nationwide: false,
  candidate_limit: 20,
  sort: "score",
};

test("Gemini 3.5 Flash-Lite runtime uses stable v1 and current pricing", () => {
  assert.equal(GEMINI_API_VERSION, "v1");
  assert.equal(GEMINI_PRICING.modelId, "gemini-3.5-flash-lite");
  assert.equal(GEMINI_PRICING.effectiveDate, "2026-08-09");
  assert.deepEqual(
    estimateGeminiCost("free", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      thinkingTokens: 1_000_000,
    }),
    { amount: 0, currency: "USD" },
  );
  assert.deepEqual(
    estimateGeminiCost("paid", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      thinkingTokens: 1_000_000,
    }),
    { amount: 5.3, currency: "USD" },
  );
});

test("analysis request accepts only mock and at most 20 unique candidate ids", () => {
  const parsed = parseGrantAnalysisRequest({
    provider: "mock",
    search,
    candidate_ids: [1, 2, 3],
  });
  assert.equal(parsed.ok, true);

  assert.equal(
    parseGrantAnalysisRequest({
      provider: "gemini",
      search,
      candidate_ids: [1, 2],
    }).ok,
    true,
  );

  assert.equal(
    parseGrantAnalysisRequest({
      provider: "openai",
      search,
      candidate_ids: [1],
    }).ok,
    false,
  );
  assert.equal(
    parseGrantAnalysisRequest({
      provider: "mock",
      search,
      candidate_ids: Array.from({ length: 21 }, (_, index) => index + 1),
    }).ok,
    false,
  );
  assert.equal(
    parseGrantAnalysisRequest({
      provider: "mock",
      search,
      candidate_ids: [1, 1],
    }).ok,
    false,
  );
});

test("unknown announcements are removed and evidence-free strong results are downgraded", () => {
  const input = analysisInput([candidate(1), candidate(2)]);
  const response: GrantAnalysisResponse = {
    provider: "unsafe-provider",
    model: "test",
    billingTier: "unknown",
    inputTokens: -10,
    outputTokens: 5,
    thinkingTokens: -1,
    totalTokens: 5,
    durationMs: 12,
    totalDurationMs: 20,
    estimatedCost: { amount: -1, currency: "KRW" },
    apiCalls: 1,
    results: [
      {
        announcementId: 1,
        classification: "A",
        confidence: 0.99,
        reasons: ["강한 판정"],
        evidence: [],
        missingConditions: [],
        cautions: [],
        requiresVerification: false,
      },
      {
        announcementId: 999,
        classification: "A",
        confidence: 1,
        reasons: ["DB에 없는 공고"],
        evidence: ["근거"],
        missingConditions: [],
        cautions: [],
        requiresVerification: false,
      },
    ],
  };

  const normalized = normalizeGrantAnalysisResponse(input, response);
  assert.equal(normalized.results.length, 1);
  assert.equal(normalized.results[0].classification, "C");
  assert.equal(normalized.results[0].confidence, 0.49);
  assert.equal(normalized.results[0].requiresVerification, true);
  assert.match(normalized.results[0].cautions[0], /공식 원문/);
  assert.equal(normalized.inputTokens, 0);
  assert.equal(normalized.estimatedCost.amount, 0);
});

test("unknown user conditions cannot produce an EXCLUDE result", () => {
  const input = {
    ...analysisInput([
      {
        ...candidate(1),
        target: "여성 예비창업자",
        detailContent: "신청대상\n여성 예비창업자",
      },
      {
        ...candidate(2),
        target: "현재 재직자",
        detailContent: "신청대상\n현재 재직자",
      },
    ]),
    profile: { ...profile, employment_status: "미취업" },
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
        announcementId: 1,
        classification: "EXCLUDE",
        confidence: 0.95,
        reasons: ["여성 전용 공고이나 사용자 성별 정보가 없습니다."],
        evidence: ["여성 예비창업자"],
        missingConditions: ["사용자 성별 확인 필요"],
        cautions: [],
        requiresVerification: false,
      },
      {
        announcementId: 2,
        classification: "EXCLUDE",
        confidence: 0.9,
        reasons: ["공고는 재직자 전용이며 사용자는 미취업 상태입니다."],
        evidence: ["현재 재직자"],
        missingConditions: [],
        cautions: [],
        requiresVerification: false,
      },
    ],
  };

  const normalized = normalizeGrantAnalysisResponse(input, response);
  assert.equal(normalized.results[0].classification, "B");
  assert.equal(normalized.results[0].confidence, 0.69);
  assert.equal(normalized.results[0].requiresVerification, true);
  assert.match(normalized.results[0].cautions[0], /확인/);
  assert.equal(normalized.results[1].classification, "EXCLUDE");
  assert.equal(normalized.results[1].confidence, 0.9);
});

test("uncertainty wording cannot bypass EXCLUDE safety with an empty missing list", () => {
  const input = analysisInput([
    {
      ...candidate(1),
      target: "여성 예비창업자",
      detailContent: "신청대상\n여성 예비창업자",
    },
  ]);
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
        announcementId: 1,
        classification: "EXCLUDE",
        confidence: 0.95,
        reasons: [
          "The user profile does not specify gender, but the announcement explicitly restricts applicants to female founders.",
        ],
        evidence: ["Target: female prospective founders"],
        missingConditions: [],
        cautions: ["Explicitly limited to female founders."],
        requiresVerification: false,
      },
    ],
  };

  const normalized = normalizeGrantAnalysisResponse(input, response);
  assert.equal(normalized.results[0].classification, "B");
  assert.ok(normalized.results[0].confidence <= 0.69);
  assert.equal(normalized.results[0].requiresVerification, true);
  assert.match(normalized.results[0].cautions.at(-1) ?? "", /확인/);
});

test("missing degree on a graduate-only announcement forces EXCLUDE to B", () => {
  const input = analysisInput([
    {
      ...candidate(1),
      target: "석사 또는 박사 학위 보유 예비창업자",
      detailContent: "신청대상\n석사 또는 박사 학위 보유 예비창업자",
    },
  ]);
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    classification: "EXCLUDE",
    confidence: 0.95,
    reasons: ["사용자의 학위가 확인되지 않아 지원 대상이 아닙니다."],
    evidence: ["석사 또는 박사 학위 보유 예비창업자"],
    missingConditions: [],
  };

  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  assert.equal(result.classification, "B");
  assert.equal(result.requiresVerification, true);
  assert.ok(result.missingConditions.includes("학위 확인 필요"));
  assert.ok(result.safetyRules?.includes("eligibility_unknown_requires_review"));
});

test("missing gender on a women-only announcement forces EXCLUDE to B", () => {
  const input = analysisInput([
    {
      ...candidate(1),
      target: "여성 창업자",
      detailContent: "신청대상\n여성 창업자",
    },
  ]);
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    classification: "EXCLUDE",
    confidence: 0.9,
    reasons: ["여성 창업자 전용 공고입니다."],
    evidence: ["여성 창업자"],
    missingConditions: [],
  };
  assert.equal(
    normalizeGrantAnalysisResponse(input, response).results[0].classification,
    "B",
  );
});

test("missing startup years on a limited announcement forces EXCLUDE to B", () => {
  const input = {
    ...analysisInput([
      {
        ...candidate(1),
        target: "창업 3년 이내 기업",
        detailContent: "신청대상\n창업 3년 이내 기업",
      },
    ]),
    profile: { ...profile, user_type: "other", startup_years: "not_applicable" },
  };
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    classification: "EXCLUDE",
    confidence: 0.9,
    reasons: ["사용자의 업력을 확인할 수 없어 3년 이내 조건과 불일치합니다."],
    evidence: ["창업 3년 이내 기업"],
    missingConditions: [],
  };
  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  assert.equal(result.classification, "B");
  assert.ok(result.missingConditions.includes("업력 확인 필요"));
});

test("an explicit male profile can be excluded from a women-only announcement", () => {
  const input = {
    ...analysisInput([
      {
        ...candidate(1),
        target: "여성 창업자",
        detailContent: "신청대상\n여성 창업자",
      },
    ]),
    profile: { ...profile, gender: "male" },
  };
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    classification: "EXCLUDE",
    confidence: 0.9,
    reasons: ["사용자는 남성으로 입력되었고 공고는 여성 창업자만 지원합니다."],
    evidence: ["여성 창업자"],
    missingConditions: [],
  };
  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  assert.equal(result.classification, "EXCLUDE");
  assert.equal(result.serverAdjusted, true);
  assert.ok(result.safetyRules?.includes("eligibility_mismatch_enforced"));
});

test("English explanations and unsupported generic eligibility guesses are removed", () => {
  const input = analysisInput([candidate(1)]);
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    classification: "A",
    confidence: 0.9,
    reasons: [
      "The applicant is highly likely to qualify.",
      "일반적으로 법인 설립이 요구됩니다.",
    ],
    evidence: ["서울 소재 예비창업자"],
    missingConditions: [],
    cautions: [],
    requiresVerification: false,
  };
  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  assert.equal(result.classification, "B");
  assert.ok(result.safetyRules?.includes("non_korean_output_removed"));
  assert.ok(
    result.safetyRules?.includes("unsupported_announcement_condition_removed"),
  );
  assert.ok(result.reasons.every((reason) => /[가-힣]/.test(reason)));
  assert.doesNotMatch(result.reasons.join(" "), /법인 설립/);
});

test("mock provider renders every classification without tokens or cost", async () => {
  const input = analysisInput([
    candidate(1),
    candidate(2),
    candidate(3),
    candidate(4),
  ]);
  const response = await analyzeGrantCandidates(mockGrantAnalysisProvider, input);

  assert.deepEqual(
    response.results.map(({ classification }) => classification),
    ["A", "B", "C", "EXCLUDE"],
  );
  assert.equal(response.provider, "mock");
  assert.equal(response.model, "deterministic-ui-v1");
  assert.equal(response.apiCalls, 0);
  assert.equal(response.inputTokens, 0);
  assert.equal(response.outputTokens, 0);
  assert.deepEqual(response.estimatedCost, { amount: 0, currency: "KRW" });
  assert.ok(response.results.every(({ requiresVerification }) => requiresVerification));
});

test("provider boundary rejects more than 20 candidates", async () => {
  const input = analysisInput(
    Array.from({ length: 21 }, (_, index) => candidate(index + 1)),
  );
  await assert.rejects(
    () => analyzeGrantCandidates(mockGrantAnalysisProvider, input),
    /GRANT_ANALYSIS_CANDIDATE_LIMIT/,
  );
});

test("Gemini-sized batches split 20, 19, 14 and small inputs predictably", () => {
  const sizes = (count: number) =>
    splitGrantAnalysisCandidates(
      Array.from({ length: count }, (_, index) => index + 1),
    ).map((batch) => batch.length);
  assert.deepEqual(sizes(20), [7, 7, 6]);
  assert.deepEqual(sizes(19), [7, 7, 5]);
  assert.deepEqual(sizes(14), [7, 7]);
  assert.deepEqual(sizes(7), [7]);
  assert.deepEqual(sizes(5), [5]);
});

test("batched analysis merges usage and preserves the original candidate order", async () => {
  const calls: number[][] = [];
  const provider = recordingProvider(calls);
  const input = analysisInput(
    Array.from({ length: 20 }, (_, index) => candidate(index + 1)),
  );
  const response = await analyzeGrantCandidatesInBatches(provider, input);

  assert.deepEqual(calls.map((ids) => ids.length), [7, 7, 6]);
  assert.deepEqual(response.batchSizes, [7, 7, 6]);
  assert.equal(response.apiCalls, 3);
  assert.equal(response.inputTokens, 20);
  assert.equal(response.outputTokens, 40);
  assert.equal(response.totalTokens, 60);
  assert.equal(response.durationMs, 30);
  assert.deepEqual(
    response.results.map(({ announcementId }) => announcementId),
    input.candidates.map(({ id }) => id),
  );
});

test("a failed middle batch stops the run and never returns partial success", async () => {
  const calls: number[][] = [];
  const base = recordingProvider(calls);
  const provider: GrantAnalysisProvider = {
    ...base,
    async analyze(input) {
      if (calls.length === 1) {
        calls.push(input.candidates.map(({ id }) => id));
        throw new Error("SECOND_BATCH_FAILED");
      }
      return base.analyze(input);
    },
  };
  const input = analysisInput(
    Array.from({ length: 20 }, (_, index) => candidate(index + 1)),
  );

  await assert.rejects(
    () => analyzeGrantCandidatesInBatches(provider, input),
    (error) => {
      assert.ok(error instanceof GrantAnalysisBatchError);
      assert.equal(error.successfulBatches, 1);
      assert.equal(error.failedBatch, 2);
      assert.deepEqual(error.batchSizes, [7, 7, 6]);
      return true;
    },
  );
  assert.deepEqual(calls.map((ids) => ids.length), [7, 7]);
});

test("missing results fail the current batch instead of leaking a partial result", async () => {
  const calls: number[][] = [];
  const base = recordingProvider(calls);
  const provider: GrantAnalysisProvider = {
    ...base,
    async analyze(input) {
      const response = await base.analyze(input);
      return { ...response, results: response.results.slice(1) };
    },
  };
  const input = analysisInput(
    Array.from({ length: 14 }, (_, index) => candidate(index + 1)),
  );
  await assert.rejects(
    () => analyzeGrantCandidatesInBatches(provider, input),
    (error) =>
      error instanceof GrantAnalysisBatchError && error.failedBatch === 1,
  );
  assert.equal(calls.length, 1);
});

test("region metadata is not adopted as a structured eligibility fact", () => {
  const metadataOnly = {
    ...candidate(1),
    target: "인공지능 기술 및 서비스를 준비 중인 예비창업자",
    summary: "서울시에서 설립한 AI 허브가 입주기업을 모집합니다.",
    detailContent:
      "신청대상\n인공지능 기술을 준비 중인 예비창업자\n제외대상\n서울시 소재 창업공간 수혜 중인 기업",
  };
  const input = analysisInput([metadataOnly]);
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
        announcementId: 1,
        classification: "B",
        confidence: 0.9,
        reasons: ["서울 소재 예비창업자이므로 지역 자격이 일치합니다."],
        evidence: ["regionMetadata: 서울"],
        missingConditions: [],
        cautions: [],
        requiresVerification: false,
      },
    ],
  };
  const validation = validateEligibility(input.profile, metadataOnly);
  assert.equal(validation.announcement.regionProvince.state, "NOT_APPLICABLE");
  assert.equal(validation.announcement.regionDistrict.state, "NOT_APPLICABLE");
  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  assert.equal(result.classification, "B");
  assert.equal(result.reasons.some((value) => value.includes("지역 자격")), false);
  assert.equal(result.evidence.some((value) => /region\s*metadata/i.test(value)), false);
  assert.ok(result.safetyRules?.includes("region_metadata_not_eligibility"));
});

test("metadata-only region claims are removed from every explanatory field", () => {
  const metadataOnly = {
    ...candidate(1),
    target: "인공지능 분야 예비창업자",
    summary: "서울 AI 허브 입주기업 모집",
    detailContent: "신청대상\n인공지능 분야 예비창업자",
  };
  const input = analysisInput([metadataOnly]);
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    reasons: ["서울 소재 신청자만 지원 가능한 공고입니다."],
    evidence: ["인공지능 분야 예비창업자"],
    missingConditions: ["서울 거주 여부 확인 필요"],
    cautions: ["서울 지역 자격을 충족해야 합니다."],
  };

  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  const output = [
    ...result.reasons,
    ...result.missingConditions,
    ...result.cautions,
  ].join(" ");
  assert.doesNotMatch(output, /서울 (?:소재|거주|지역 자격)/);
  assert.ok(result.safetyRules?.includes("region_metadata_not_eligibility"));
});

test("organization names cannot create gender or regional eligibility", () => {
  const organizationOnly = {
    ...candidate(1),
    agency: "서울여성창업지원센터",
    region: "서울",
    regions: ["서울"],
    target: "예비창업자",
    detailContent: "신청대상\n예비창업자",
  };
  const input = analysisInput([organizationOnly]);
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    classification: "A",
    confidence: 0.92,
    reasons: ["운영기관 특성상 여성만 신청 가능합니다."],
    evidence: ["예비창업자"],
    missingConditions: ["여성 여부 확인 필요"],
    cautions: ["서울 거주 조건 확인 필요"],
  };

  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  const output = [
    ...result.reasons,
    ...result.missingConditions,
    ...result.cautions,
  ].join(" ");
  assert.equal(result.classification, "B");
  assert.equal(result.confidence, 0.69);
  assert.doesNotMatch(output, /여성|서울 거주/);
  assert.ok(
    result.safetyRules?.includes("unsupported_announcement_condition_removed"),
  );
});

test("preferred conditions cannot be strengthened into required eligibility", () => {
  const preferredMajor = {
    ...candidate(1),
    target: "예비창업자, AI 전공자 우대",
    detailContent: "신청대상\n예비창업자\n우대사항\nAI 전공자 우대",
  };
  const input = analysisInput([preferredMajor]);
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    classification: "A",
    confidence: 0.9,
    reasons: ["AI 전공이 필수 자격입니다."],
    evidence: ["AI 전공자 우대"],
    missingConditions: ["AI 전공 여부 확인 필요"],
  };

  const validation = validateEligibility(input.profile, preferredMajor);
  assert.equal(validation.announcement.major.strength, "PREFERRED");
  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  assert.equal(result.classification, "B");
  assert.equal(result.confidence, 0.69);
  assert.doesNotMatch(
    [...result.reasons, ...result.missingConditions].join(" "),
    /AI 전공/,
  );
  assert.ok(
    result.safetyRules?.includes("unsupported_announcement_condition_removed"),
  );
});

test("organization words containing youth do not create an age condition", () => {
  const input = analysisInput([
    {
      ...candidate(1),
      target: "청년취업사관학교 수료생 및 서울 소재 예비 창업가",
      detailContent:
        "신청대상\n청년취업사관학교 수료생 및 서울 소재 예비 창업가",
    },
  ]);
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    classification: "A",
    confidence: 0.9,
    reasons: ["서울 소재 예비 창업가 조건에 부합합니다."],
    evidence: ["청년취업사관학교 수료생 및 서울 소재 예비 창업가"],
    cautions: ["청년취업사관학교 수료생 자격을 확인해야 합니다."],
  };

  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  assert.equal(result.classification, "A");
  assert.match(result.cautions.join(" "), /수료생 자격/);
  assert.equal(
    result.safetyRules?.includes("unsupported_announcement_condition_removed"),
    false,
  );
});

test("province-level city names are not mistaken for district conditions", () => {
  const input = analysisInput([
    {
      ...candidate(1),
      target: "서울시 소재 예비창업자",
      detailContent: "신청대상\n서울시 소재 예비창업자",
    },
  ]);
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    classification: "A",
    confidence: 0.9,
    reasons: ["서울시 소재 예비창업자 조건과 일치합니다."],
    evidence: ["서울시 소재 예비창업자"],
  };

  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  assert.equal(result.classification, "A");
  assert.equal(
    result.safetyRules?.includes("unsupported_announcement_condition_removed"),
    false,
  );
});

test("an evidence-backed exclusion detail survives a structured parser gap", () => {
  const input = analysisInput([
    {
      ...candidate(1),
      target: "인공지능 분야 예비창업자",
      detailContent:
        "신청대상\n인공지능 분야 예비창업자\n제외대상\n서울시 또는 자치구 창업 공간 입주 지원 사업 수혜자",
    },
  ]);
  const response = providerResponse(input.candidates);
  response.provider = "gemini";
  response.results[0] = {
    ...response.results[0],
    classification: "B",
    reasons: ["예비창업자 대상 인공지능 지원 사업입니다."],
    evidence: [
      "서울시 또는 자치구 창업 공간 입주 지원 사업 수혜자 제외",
    ],
    cautions: [
      "서울시 또는 자치구 창업 공간 입주 지원 사업 중복 수혜 여부를 확인해야 합니다.",
    ],
  };

  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  assert.match(
    result.cautions.join(" "),
    /중복 수혜/,
    JSON.stringify(result),
  );
  assert.equal(
    result.safetyRules?.includes("unsupported_announcement_condition_removed"),
    false,
  );
});

test("an explicit regional target remains valid evidence", () => {
  const input = analysisInput([candidate(1)]);
  const response = providerResponse(input.candidates);
  response.results[0] = {
    ...response.results[0],
    classification: "A",
    confidence: 0.85,
    reasons: ["서울 소재 예비창업자 조건이 명시되어 있습니다."],
    evidence: ["target: 서울 소재 예비창업자"],
  };
  const result = normalizeGrantAnalysisResponse(input, response).results[0];
  assert.equal(result.classification, "A");
  assert.equal(result.serverAdjusted, false);
  assert.deepEqual(result.safetyRules, []);
});

function recordingProvider(calls: number[][]): GrantAnalysisProvider {
  return {
    id: "recording",
    model: "test",
    async analyze(input) {
      calls.push(input.candidates.map(({ id }) => id));
      return providerResponse([...input.candidates].reverse());
    },
  };
}

function providerResponse(
  candidates: GrantAnalysisCandidate[],
): GrantAnalysisResponse {
  return {
    provider: "recording",
    model: "test",
    billingTier: "free",
    inputTokens: candidates.length,
    outputTokens: candidates.length * 2,
    thinkingTokens: 0,
    totalTokens: candidates.length * 3,
    durationMs: 10,
    totalDurationMs: 12,
    estimatedCost: { amount: 0, currency: "USD" },
    apiCalls: 1,
    results: candidates.map(({ id }) => ({
      announcementId: id,
      classification: "B",
      confidence: 0.6,
      reasons: ["추가 조건 확인이 필요합니다."],
      evidence: ["공고 지원대상"],
      missingConditions: ["세부 조건"],
      cautions: [],
      requiresVerification: true,
    })),
  };
}

function analysisInput(candidates: GrantAnalysisCandidate[]): GrantAnalysisInput {
  return {
    profile,
    businessItemDescription: profile.business_item_description,
    neededSupport: profile.needed_support,
    candidates,
  };
}

function candidate(id: number): GrantAnalysisCandidate {
  return {
    id,
    title: `공고 ${id}`,
    source: "kstartup",
    source_name: "K-Startup",
    agency: "테스트 기관",
    region: "서울",
    regions: ["서울"],
    apply_start: "2026-08-01",
    apply_end: "2026-08-31",
    status: "open",
    score: 3,
    reasons: ["관심 분야 일치", "지역 일치"],
    category_ids: [1],
    category_names: ["창업지원"],
    policy_domain: null,
    policy_domain_label: null,
    detail_url: `/announcements/${id}`,
    original_url: `https://example.com/announcements/${id}`,
    target: "서울 소재 예비창업자",
    supportType: "사업화 자금",
    summary: "가상 테스트 공고 요약",
    detailContent: "가상 테스트 공고 상세 내용",
    applyMethod: "온라인 신청",
    documents: "사업계획서",
    contentTruncated: false,
  };
}
