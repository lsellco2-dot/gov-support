import {
  parseAiLabSearchInput,
  type AiLabCandidate,
  type AiLabProfile,
  type AiLabSearchInput,
} from "@/lib/admin/ai-lab-types";

export const GRANT_ANALYSIS_CLASSIFICATIONS = [
  "A",
  "B",
  "C",
  "EXCLUDE",
] as const;
export const GRANT_ANALYSIS_PROVIDERS = ["mock", "openai", "gemini"] as const;
export const MAX_GRANT_ANALYSIS_CANDIDATES = 20;

export type GrantAnalysisClassification =
  (typeof GRANT_ANALYSIS_CLASSIFICATIONS)[number];
export type GrantAnalysisProviderId =
  (typeof GRANT_ANALYSIS_PROVIDERS)[number];
export type GrantAnalysisEvaluation = "accurate" | "incorrect" | "ambiguous";

export const GRANT_ANALYSIS_SAFETY_RULES = [
  "evidence_required_downgrade",
  "unresolved_condition_exclude_to_b",
  "region_metadata_not_eligibility",
  "missing_profile_condition_exclude_to_b",
  "unsupported_announcement_condition_removed",
  "non_korean_output_removed",
  "eligibility_mismatch_enforced",
  "eligibility_unknown_requires_review",
  "eligibility_unverified_exclude_to_b",
] as const;

export type GrantAnalysisSafetyRule =
  (typeof GRANT_ANALYSIS_SAFETY_RULES)[number];

export type GrantAnalysisBillingTier = "free" | "paid" | "unknown";

export interface GrantAnalysisCandidate extends AiLabCandidate {
  target: string | null;
  supportType: string | null;
  summary: string | null;
  detailContent: string | null;
  applyMethod: string | null;
  documents: string | null;
  age_min?: number | null;
  age_max?: number | null;
  educationCondition?: string | null;
  employmentCondition?: string | null;
  majorCondition?: string | null;
  contentTruncated: boolean;
}

export interface GrantAnalysisInput {
  profile: AiLabProfile & {
    gender?: string | null;
    degree?: string | null;
    major?: string | null;
    business_status?: string | null;
    annual_revenue?: number | null;
    employee_count?: number | null;
    other_qualifications?: string[] | null;
    region_district?: string | null;
  };
  businessItemDescription: string;
  neededSupport: string;
  candidates: GrantAnalysisCandidate[];
}

export interface GrantAnnouncementAnalysis {
  announcementId: number;
  classification: GrantAnalysisClassification;
  confidence: number;
  reasons: string[];
  evidence: string[];
  evidenceIds?: string[];
  missingConditions: string[];
  cautions: string[];
  requiresVerification: boolean;
  rawClassification?: GrantAnalysisClassification;
  rawConfidence?: number;
  rawReasons?: string[];
  rawEvidence?: string[];
  rawEvidenceIds?: string[];
  rawMissingConditions?: string[];
  rawCautions?: string[];
  serverAdjusted?: boolean;
  safetyRules?: GrantAnalysisSafetyRule[];
}

export interface GrantAnalysisCost {
  amount: number;
  currency: "KRW" | "USD";
}

export interface GrantAnalysisResponse {
  provider: string;
  model: string;
  billingTier: GrantAnalysisBillingTier;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
  durationMs: number;
  totalDurationMs: number;
  estimatedCost: GrantAnalysisCost;
  apiCalls: number;
  batchSizes?: number[];
  results: GrantAnnouncementAnalysis[];
}

export interface GeminiErrorDiagnostics {
  httpStatus: number | null;
  googleCode: string;
  errorName: string;
  safeMessage: string;
  timedOut: boolean;
  aborted: boolean;
  durationMs: number;
}

export interface GrantAnalysisErrorResponse {
  error: string;
  code?: string;
  diagnostics?: GeminiErrorDiagnostics;
  batch?: {
    successfulBatches: number;
    failedBatch: number;
    totalBatches: number;
    batchSizes: number[];
  };
}

export interface GrantAnalysisRequest {
  provider: "mock" | "gemini";
  search: AiLabSearchInput;
  candidateIds: number[];
}

export interface GeminiAnalysisAvailability {
  configured: boolean;
  model: string;
  billingTier: "free" | "paid";
}

type ParseResult =
  | { ok: true; value: GrantAnalysisRequest }
  | { ok: false; error: string };

export function parseGrantAnalysisRequest(value: unknown): ParseResult {
  if (!isRecord(value)) return invalid("분석 요청 형식이 올바르지 않습니다.");
  if (value.provider !== "mock" && value.provider !== "gemini") {
    return invalid("연결된 LLM Provider가 없습니다.");
  }

  const search = parseAiLabSearchInput(value.search);
  if (!search.ok) return invalid(search.error);

  const candidateIds = value.candidate_ids;
  if (
    !Array.isArray(candidateIds) ||
    candidateIds.length === 0 ||
    candidateIds.length > MAX_GRANT_ANALYSIS_CANDIDATES ||
    candidateIds.some(
      (id) => !Number.isSafeInteger(id) || Number(id) <= 0,
    )
  ) {
    return invalid("분석 후보는 1~20개의 유효한 공고 ID여야 합니다.");
  }
  const normalizedIds = candidateIds.map(Number);
  if (new Set(normalizedIds).size !== normalizedIds.length) {
    return invalid("분석 후보에 중복된 공고가 있습니다.");
  }

  return {
    ok: true,
    value: {
      provider: value.provider,
      search: search.value,
      candidateIds: normalizedIds,
    },
  };
}

function invalid(error: string): ParseResult {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
