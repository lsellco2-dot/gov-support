import type { GrantAnalysisProvider } from "@/lib/admin/ai-analysis/provider";
import type {
  GrantAnalysisClassification,
  GrantAnalysisInput,
  GrantAnalysisResponse,
} from "@/lib/admin/ai-analysis/types";

const MOCK_MODEL = "deterministic-ui-v1";
const MOCK_SEQUENCE: GrantAnalysisClassification[] = [
  "A",
  "B",
  "C",
  "EXCLUDE",
];

export const mockGrantAnalysisProvider: GrantAnalysisProvider = {
  id: "mock",
  model: MOCK_MODEL,
  async analyze(input: GrantAnalysisInput): Promise<GrantAnalysisResponse> {
    const startedAt = performance.now();
    const results = input.candidates.map((candidate, index) => {
      const classification = MOCK_SEQUENCE[index % MOCK_SEQUENCE.length];
      const evidence = candidate.reasons
        .slice(0, 3)
        .map((reason) => `기존 AISUP 추천 근거: ${reason}`);
      return {
        announcementId: candidate.id,
        classification,
        confidence: confidenceFor(classification),
        reasons: reasonsFor(classification),
        evidence,
        missingConditions:
          classification === "B"
            ? ["공식 원문에서 추가 자격조건 충족 여부 확인 필요"]
            : [],
        cautions: [
          "Mock Provider의 UI 검증용 결과이며 실제 신청 가능 여부를 의미하지 않습니다.",
        ],
        requiresVerification: true,
      };
    });

    return {
      provider: "mock",
      model: MOCK_MODEL,
      billingTier: "unknown",
      inputTokens: 0,
      outputTokens: 0,
      thinkingTokens: 0,
      totalTokens: 0,
      durationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      totalDurationMs: Math.round((performance.now() - startedAt) * 10) / 10,
      estimatedCost: { amount: 0, currency: "KRW" },
      apiCalls: 0,
      results,
    };
  },
};

function confidenceFor(classification: GrantAnalysisClassification) {
  if (classification === "A") return 0.82;
  if (classification === "B") return 0.68;
  if (classification === "C") return 0.56;
  return 0.76;
}

function reasonsFor(classification: GrantAnalysisClassification) {
  if (classification === "A") {
    return ["기존 AISUP 조건 일치 신호를 바탕으로 A 화면 흐름을 검증합니다."];
  }
  if (classification === "B") {
    return ["추가 조건 확인이 필요한 B 화면 흐름을 검증합니다."];
  }
  if (classification === "C") {
    return ["직접 일치 여부를 더 검토해야 하는 C 화면 흐름을 검증합니다."];
  }
  return ["명확한 조건 불일치 상황을 표시하는 제외 화면 흐름을 검증합니다."];
}
