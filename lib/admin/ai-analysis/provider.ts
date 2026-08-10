import { normalizeGrantAnalysisResponse } from "@/lib/admin/ai-analysis/classification";
import {
  MAX_GRANT_ANALYSIS_CANDIDATES,
  type GrantAnalysisInput,
  type GrantAnalysisResponse,
} from "@/lib/admin/ai-analysis/types";

export interface GrantAnalysisProvider {
  readonly id: string;
  readonly model: string;
  analyze(input: GrantAnalysisInput): Promise<GrantAnalysisResponse>;
}

export const GRANT_ANALYSIS_BATCH_SIZE = 7;

export class GrantAnalysisBatchError extends Error {
  constructor(
    readonly successfulBatches: number,
    readonly failedBatch: number,
    readonly batchSizes: number[],
    readonly batchCause: unknown,
  ) {
    super("GRANT_ANALYSIS_BATCH_FAILED");
    this.name = "GrantAnalysisBatchError";
  }
}

export async function analyzeGrantCandidates(
  provider: GrantAnalysisProvider,
  input: GrantAnalysisInput,
) {
  assertSafeInput(input);
  const response = await provider.analyze(input);
  const normalized = normalizeGrantAnalysisResponse(input, response);
  assertExactResultIds(input, normalized.results);
  return {
    ...normalized,
    provider: provider.id,
    model: provider.model,
    batchSizes: normalized.batchSizes?.length
      ? normalized.batchSizes
      : [input.candidates.length],
  };
}

export async function analyzeGrantCandidatesInBatches(
  provider: GrantAnalysisProvider,
  input: GrantAnalysisInput,
  batchSize = GRANT_ANALYSIS_BATCH_SIZE,
) {
  assertSafeInput(input);
  const batches = splitGrantAnalysisCandidates(input.candidates, batchSize);
  const batchSizes = batches.map((batch) => batch.length);
  const responses: GrantAnalysisResponse[] = [];

  for (const [index, candidates] of batches.entries()) {
    try {
      responses.push(
        await analyzeGrantCandidates(provider, { ...input, candidates }),
      );
    } catch (error) {
      throw new GrantAnalysisBatchError(
        responses.length,
        index + 1,
        batchSizes,
        error,
      );
    }
  }

  return mergeGrantAnalysisResponses(input, provider, responses, batchSizes);
}

export function splitGrantAnalysisCandidates<T>(
  candidates: T[],
  batchSize = GRANT_ANALYSIS_BATCH_SIZE,
) {
  if (!Number.isSafeInteger(batchSize) || batchSize <= 0) {
    throw new Error("GRANT_ANALYSIS_INVALID_BATCH_SIZE");
  }
  const batches: T[][] = [];
  for (let index = 0; index < candidates.length; index += batchSize) {
    batches.push(candidates.slice(index, index + batchSize));
  }
  return batches;
}

function mergeGrantAnalysisResponses(
  input: GrantAnalysisInput,
  provider: GrantAnalysisProvider,
  responses: GrantAnalysisResponse[],
  batchSizes: number[],
): GrantAnalysisResponse {
  const expectedIds = input.candidates.map(({ id }) => id);
  const resultById = new Map(
    responses.flatMap(({ results }) => results).map((result) => [result.announcementId, result]),
  );
  if (
    resultById.size !== expectedIds.length ||
    expectedIds.some((id) => !resultById.has(id))
  ) {
    throw new Error("GRANT_ANALYSIS_BATCH_RESULT_MISMATCH");
  }
  const first = responses[0];
  if (!first) throw new Error("GRANT_ANALYSIS_BATCH_RESULT_MISSING");
  const currency = first.estimatedCost.currency;
  if (responses.some((response) => response.estimatedCost.currency !== currency)) {
    throw new Error("GRANT_ANALYSIS_BATCH_COST_MISMATCH");
  }

  return {
    provider: provider.id,
    model: provider.model,
    billingTier: first.billingTier,
    inputTokens: sum(responses, "inputTokens"),
    outputTokens: sum(responses, "outputTokens"),
    thinkingTokens: sum(responses, "thinkingTokens"),
    totalTokens: sum(responses, "totalTokens"),
    durationMs: sum(responses, "durationMs"),
    totalDurationMs: sum(responses, "totalDurationMs"),
    estimatedCost: {
      amount: responses.reduce(
        (total, response) => total + response.estimatedCost.amount,
        0,
      ),
      currency,
    },
    apiCalls: sum(responses, "apiCalls"),
    batchSizes,
    results: expectedIds.map((id) => resultById.get(id)!),
  };
}

function sum(
  responses: GrantAnalysisResponse[],
  field:
    | "inputTokens"
    | "outputTokens"
    | "thinkingTokens"
    | "totalTokens"
    | "durationMs"
    | "totalDurationMs"
    | "apiCalls",
) {
  return responses.reduce((total, response) => total + response[field], 0);
}

function assertSafeInput(input: GrantAnalysisInput) {
  if (
    input.candidates.length === 0 ||
    input.candidates.length > MAX_GRANT_ANALYSIS_CANDIDATES
  ) {
    throw new Error("GRANT_ANALYSIS_CANDIDATE_LIMIT");
  }
  const ids = input.candidates.map(({ id }) => id);
  if (
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error("GRANT_ANALYSIS_INVALID_CANDIDATES");
  }
}

function assertExactResultIds(
  input: GrantAnalysisInput,
  results: GrantAnalysisResponse["results"],
) {
  const expectedIds = input.candidates.map(({ id }) => id);
  const actualIds = results.map(({ announcementId }) => announcementId);
  if (
    actualIds.length !== expectedIds.length ||
    new Set(actualIds).size !== expectedIds.length ||
    expectedIds.some((id) => !actualIds.includes(id))
  ) {
    throw new Error("GRANT_ANALYSIS_RESULT_MISMATCH");
  }
}
