import {
  GRANT_ANALYSIS_CLASSIFICATIONS,
  type GrantAnalysisInput,
  type GeminiErrorDiagnostics,
} from "@/lib/admin/ai-analysis/types";
import {
  buildCompactGrantAnalysisPayload,
  evidenceTextById,
} from "@/lib/admin/ai-analysis/compact-input";

export type GeminiAnalysisErrorCode =
  | "GEMINI_API_KEY_MISSING"
  | "GEMINI_SENSITIVE_INPUT_REJECTED"
  | "GEMINI_INVALID_REQUEST"
  | "GEMINI_PARAMETER_UNKNOWN"
  | "GEMINI_FAILED_PRECONDITION"
  | "GEMINI_AUTH_FAILED"
  | "GEMINI_PERMISSION_DENIED"
  | "GEMINI_MODEL_NOT_FOUND"
  | "GEMINI_NOT_FOUND"
  | "GEMINI_RATE_LIMIT_EXCEEDED"
  | "GEMINI_QUOTA_EXCEEDED"
  | "GEMINI_CANCELLED"
  | "GEMINI_API_ERROR"
  | "GEMINI_SERVICE_UNAVAILABLE"
  | "GEMINI_DEADLINE_EXCEEDED"
  | "GEMINI_CLIENT_TIMEOUT"
  | "FREE_TIER_LIMIT_REACHED"
  | "GEMINI_TIMEOUT"
  | "GEMINI_NETWORK_ERROR"
  | "GEMINI_SERVICE_ERROR"
  | "GEMINI_STRUCTURED_OUTPUT_ERROR"
  | "GEMINI_RESPONSE_INCOMPLETE";

export class GeminiAnalysisError extends Error {
  constructor(
    readonly code: GeminiAnalysisErrorCode,
    readonly diagnostics?: GeminiErrorDiagnostics,
  ) {
    super(code);
    this.name = "GeminiAnalysisError";
  }
}

export function buildGeminiGrantAnalysisPrompt(input: GrantAnalysisInput) {
  return [
    "AISUP 규칙 엔진이 선별한 실제 DB 후보만 분석하세요. 외부 검색과 새 조건 생성은 금지합니다.",
    "A=현재 조건 일치 가능성 높음, B=추가 조건 확인 필요, C=관련 사업 검토, EXCLUDE=명시적 필수조건 불일치입니다.",
    "미입력 사용자 조건은 B+확인 필요이며 EXCLUDE 근거가 아닙니다.",
    "자격 판정은 eligibilityFacts와 evidence 중 kind=eligibility인 항목만 사용하세요.",
    "metadata의 title, organization, regionMetadata는 표시용이며 자격조건 근거가 아닙니다.",
    "근거는 후보에 실제 존재하는 evidence ID만 최대 3개 반환하세요. 근거 문장을 새로 쓰지 마세요.",
    "reasons 최대 2개, missingConditions 최대 3개, cautions 최대 2개로 모두 한국어로 간결히 작성하세요.",
    "확인되지 않은 신청 가능성을 보장하지 말고 모든 후보를 정확히 한 번 포함하세요.",
    "",
    JSON.stringify(buildCompactGrantAnalysisPayload(input)),
  ].join("\n");
}

export function parseGeminiGrantAnalysisOutput(
  text: string,
  input: GrantAnalysisInput,
) {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new GeminiAnalysisError("GEMINI_STRUCTURED_OUTPUT_ERROR");
  }
  if (!isRecord(value) || !Array.isArray(value.results)) {
    throw new GeminiAnalysisError("GEMINI_STRUCTURED_OUTPUT_ERROR");
  }

  const candidateIds = input.candidates.map(({ id }) => id);
  const allowedIds = new Set(candidateIds);
  const evidenceByCandidate = evidenceTextById(input);
  const seenIds = new Set<number>();
  const results = value.results.map((raw) => {
    if (!isRecord(raw)) structuredOutputError();
    const announcementId = Number(raw.announcementId);
    if (
      !Number.isSafeInteger(announcementId) ||
      !allowedIds.has(announcementId) ||
      seenIds.has(announcementId) ||
      !GRANT_ANALYSIS_CLASSIFICATIONS.includes(
        raw.classification as (typeof GRANT_ANALYSIS_CLASSIFICATIONS)[number],
      ) ||
      typeof raw.confidence !== "number" ||
      !Number.isFinite(raw.confidence) ||
      raw.confidence < 0 ||
      raw.confidence > 1 ||
      typeof raw.requiresVerification !== "boolean"
    ) {
      structuredOutputError();
    }
    const reasons = stringArray(raw.reasons, 2);
    const evidenceIds = evidenceIdArray(raw.evidenceIds);
    const missingConditions = stringArray(raw.missingConditions, 3);
    const cautions = stringArray(raw.cautions, 2);
    const allowedEvidence = evidenceByCandidate.get(announcementId);
    if (
      !reasons ||
      !evidenceIds ||
      !missingConditions ||
      !cautions ||
      !allowedEvidence ||
      evidenceIds.some((id) => !allowedEvidence.has(id))
    ) {
      structuredOutputError();
    }
    seenIds.add(announcementId);
    return {
      announcementId,
      classification:
        raw.classification as (typeof GRANT_ANALYSIS_CLASSIFICATIONS)[number],
      confidence: raw.confidence,
      reasons,
      evidenceIds,
      evidence: evidenceIds.map((id) => allowedEvidence.get(id)!),
      missingConditions,
      cautions,
      requiresVerification: raw.requiresVerification,
    };
  });

  if (results.length !== candidateIds.length || seenIds.size !== allowedIds.size) {
    throw new GeminiAnalysisError("GEMINI_RESPONSE_INCOMPLETE");
  }
  return results;
}

export function grantAnalysisJsonSchema(candidateCount: number) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        minItems: candidateCount,
        maxItems: candidateCount,
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "announcementId",
            "classification",
            "confidence",
            "reasons",
            "evidenceIds",
            "missingConditions",
            "cautions",
            "requiresVerification",
          ],
          properties: {
            announcementId: { type: "integer" },
            classification: {
              type: "string",
              enum: [...GRANT_ANALYSIS_CLASSIFICATIONS],
            },
            confidence: { type: "number", minimum: 0, maximum: 1 },
            reasons: stringArraySchema(2),
            evidenceIds: evidenceIdArraySchema(),
            missingConditions: stringArraySchema(3),
            cautions: stringArraySchema(2),
            requiresVerification: { type: "boolean" },
          },
        },
      },
    },
  };
}

export function assertSyntheticGrantAnalysisInput(input: GrantAnalysisInput) {
  const freeText = `${input.businessItemDescription}\n${input.neededSupport}`;
  const hasEmail = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(freeText);
  const hasPhone = /(?:01[016789])[-\s]?\d{3,4}[-\s]?\d{4}/.test(freeText);
  const hasRegistrationNumber = /\b\d{3}[-\s]?\d{2}[-\s]?\d{5}\b/.test(freeText);
  if (hasEmail || hasPhone || hasRegistrationNumber) {
    throw new GeminiAnalysisError("GEMINI_SENSITIVE_INPUT_REJECTED");
  }
}

function stringArraySchema(maxItems: number) {
  return {
    type: "array",
    maxItems,
    items: { type: "string", maxLength: 300 },
  };
}

function stringArray(value: unknown, maxItems: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxItems) return null;
  if (value.some((item) => typeof item !== "string" || item.length > 300)) {
    return null;
  }
  return value as string[];
}

function evidenceIdArraySchema() {
  return {
    type: "array",
    maxItems: 3,
    items: { type: "string", pattern: "^E[1-8]$" },
  };
}

function evidenceIdArray(value: unknown): string[] | null {
  if (
    !Array.isArray(value) ||
    value.length > 3 ||
    value.some((item) => typeof item !== "string" || !/^E[1-8]$/.test(item)) ||
    new Set(value).size !== value.length
  ) {
    return null;
  }
  return value as string[];
}

function structuredOutputError(): never {
  throw new GeminiAnalysisError("GEMINI_STRUCTURED_OUTPUT_ERROR");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
