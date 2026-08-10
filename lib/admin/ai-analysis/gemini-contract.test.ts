import assert from "node:assert/strict";
import test from "node:test";
import {
  assertSyntheticGrantAnalysisInput,
  buildGeminiGrantAnalysisPrompt,
  GeminiAnalysisError,
  grantAnalysisJsonSchema,
  parseGeminiGrantAnalysisOutput,
} from "@/lib/admin/ai-analysis/gemini-contract";
import { buildCompactGrantAnalysisPayload } from "@/lib/admin/ai-analysis/compact-input";
import type {
  GrantAnalysisCandidate,
  GrantAnalysisInput,
} from "@/lib/admin/ai-analysis/types";

test("Gemini prompt contains only the supplied synthetic profile and canonical candidates", () => {
  const input = analysisInput([candidate(1), candidate(2)]);
  const prompt = buildGeminiGrantAnalysisPrompt(input);
  assert.match(prompt, /외부 검색과 새 조건 생성은 금지합니다/);
  assert.match(prompt, /미입력 사용자 조건은 B/);
  assert.match(prompt, /표시용이며 자격조건 근거가 아닙니다/);
  assert.match(prompt, /evidence ID/);
  assert.match(prompt, /AI 기반 음식점 예약 서비스/);
  assert.match(prompt, /"announcementId":1/);
  assert.match(prompt, /"regionMetadata":\["서울"\]/);
  assert.match(prompt, /"eligibilityFacts"/);
  assert.match(prompt, /"id":"E1"/);
  assert.doesNotMatch(prompt, /"detailContent"/);
  assert.doesNotMatch(prompt, /"applyMethod"/);
  assert.doesNotMatch(prompt, /"documents"/);
  assert.doesNotMatch(prompt, /"existingRecommendationReasons"/);
  assert.doesNotMatch(prompt, /GEMINI_API_KEY/);

  const schema = grantAnalysisJsonSchema(2) as {
    properties: { results: { minItems: number; maxItems: number } };
  };
  assert.equal(schema.properties.results.minItems, 2);
  assert.equal(schema.properties.results.maxItems, 2);
});

test("Gemini structured output requires every canonical candidate exactly once", () => {
  const valid = JSON.stringify({
    results: [analysisResult(1, "A"), analysisResult(2, "B")],
  });
  const input = analysisInput([candidate(1), candidate(2)]);
  const parsed = parseGeminiGrantAnalysisOutput(valid, input);
  assert.deepEqual(parsed.map(({ announcementId }) => announcementId), [1, 2]);
  assert.deepEqual(parsed[0].evidenceIds, ["E1"]);
  assert.match(parsed[0].evidence[0], /서울 소재 예비창업자/);

  assert.throws(
    () =>
      parseGeminiGrantAnalysisOutput(
        JSON.stringify({ results: [analysisResult(1, "A")] }),
        input,
      ),
    (error) =>
      error instanceof GeminiAnalysisError &&
      error.code === "GEMINI_RESPONSE_INCOMPLETE",
  );
  assert.throws(
    () =>
      parseGeminiGrantAnalysisOutput(
        JSON.stringify({
          results: [analysisResult(1, "A"), analysisResult(999, "B")],
        }),
        input,
      ),
    (error) =>
      error instanceof GeminiAnalysisError &&
      error.code === "GEMINI_STRUCTURED_OUTPUT_ERROR",
  );
});

test("Gemini structured output rejects invalid classifications and malformed arrays", () => {
  const invalidClassification = analysisResult(1, "A") as Record<string, unknown>;
  invalidClassification.classification = "MAYBE";
  assert.throws(
    () =>
      parseGeminiGrantAnalysisOutput(
        JSON.stringify({ results: [invalidClassification] }),
        analysisInput([candidate(1)]),
      ),
    /GEMINI_STRUCTURED_OUTPUT_ERROR/,
  );

  const invalidEvidence = analysisResult(1, "A") as Record<string, unknown>;
  invalidEvidence.evidenceIds = ["E9"];
  assert.throws(
    () =>
      parseGeminiGrantAnalysisOutput(
        JSON.stringify({ results: [invalidEvidence] }),
        analysisInput([candidate(1)]),
      ),
    /GEMINI_STRUCTURED_OUTPUT_ERROR/,
  );
});

test("compact payload removes raw duplicate fields but keeps eligibility facts and evidence", () => {
  const duplicate = candidate(1);
  duplicate.summary = "서울 소재 예비창업자";
  duplicate.detailContent = "신청대상\n서울 소재 예비창업자\n신청방법\n온라인 신청";
  const input = analysisInput([duplicate]);
  const payload = buildCompactGrantAnalysisPayload(input);
  const compact = payload.candidates[0];
  const serialized = JSON.stringify(payload);

  assert.ok(compact.eligibilityFacts.some(({ dimension }) => dimension === "startupStatus"));
  assert.ok(compact.eligibilityFacts.some(({ dimension }) => dimension === "regionProvince"));
  assert.ok(compact.evidence.some(({ text }) => text.includes("서울 소재 예비창업자")));
  assert.doesNotMatch(serialized, /detailContent|applyMethod|documents|summary/);
  assert.equal(
    compact.evidence.filter(({ text }) => text.includes("서울 소재 예비창업자")).length,
    1,
  );
});

test("compact evidence preserves the known regression eligibility phrases", () => {
  const cases = [
    candidateWith(37817, "청년 예비 및 초기창업자(1987년 이후 출생자)"),
    candidateWith(35132, "이공계(예비)석·박사급 연구인력, 기술사업화 분야 (예비)창업자·초기창업자"),
    candidateWith(36448, "기업의 성장을 고민하는 여성CEO"),
    candidateWith(25635, "여성 1인 창조기업 및 여성 (예비)창업자"),
  ];
  const payload = buildCompactGrantAnalysisPayload(analysisInput(cases));
  for (const compact of payload.candidates) {
    assert.ok(compact.evidence.some(({ kind }) => kind === "eligibility"));
    assert.ok(compact.eligibilityFacts.length > 0);
  }
});

test("Gemini Free Tier experiment rejects obvious personal identifiers", () => {
  const input = analysisInput([candidate(1)]);
  assert.doesNotThrow(() => assertSyntheticGrantAnalysisInput(input));

  assert.throws(
    () =>
      assertSyntheticGrantAnalysisInput({
        ...input,
        businessItemDescription: "연락처 test@example.com으로 제안",
      }),
    (error) =>
      error instanceof GeminiAnalysisError &&
      error.code === "GEMINI_SENSITIVE_INPUT_REJECTED",
  );
});

function analysisInput(candidates: GrantAnalysisCandidate[]): GrantAnalysisInput {
  return {
    profile: {
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
      business_item_description: "AI 기반 음식점 예약 서비스",
      needed_support: "초기 사업화 자금과 마케팅",
    },
    businessItemDescription: "AI 기반 음식점 예약 서비스",
    neededSupport: "초기 사업화 자금과 마케팅",
    candidates,
  };
}

function candidate(id: number): GrantAnalysisCandidate {
  return {
    id,
    title: `공고 ${id}`,
    source: "kstartup",
    source_name: "K-Startup",
    agency: "가상 기관",
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
    summary: `공고 요약 ${id}`,
    detailContent: `공고 상세 ${id}`,
    applyMethod: "온라인 신청",
    documents: "사업계획서",
    contentTruncated: false,
  };
}

function candidateWith(id: number, target: string) {
  return { ...candidate(id), target, detailContent: `신청대상\n${target}` };
}

function analysisResult(id: number, classification: "A" | "B") {
  return {
    announcementId: id,
    classification,
    confidence: 0.8,
    reasons: ["조건 검토 결과"],
    evidenceIds: ["E1"],
    missingConditions: [],
    cautions: ["공식 원문 확인 필요"],
    requiresVerification: true,
  };
}
