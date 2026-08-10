import "server-only";

import { performance } from "node:perf_hooks";
import {
  assertSyntheticGrantAnalysisInput,
  buildGeminiGrantAnalysisPrompt,
  GeminiAnalysisError,
  grantAnalysisJsonSchema,
  parseGeminiGrantAnalysisOutput,
} from "@/lib/admin/ai-analysis/gemini-contract";
import { getGeminiRuntimeConfig } from "@/lib/admin/ai-analysis/gemini-config";
import { mapGeminiProviderError } from "@/lib/admin/ai-analysis/gemini-error";
import {
  estimateGeminiCost,
  GEMINI_API_VERSION,
} from "@/lib/admin/ai-analysis/gemini-runtime";
import type { GrantAnalysisProvider } from "@/lib/admin/ai-analysis/provider";
import type {
  GrantAnalysisInput,
  GrantAnalysisResponse,
} from "@/lib/admin/ai-analysis/types";

export {
  GeminiAnalysisError,
  type GeminiAnalysisErrorCode,
} from "@/lib/admin/ai-analysis/gemini-contract";

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_OUTPUT_TOKENS = 8_192;

export function buildGeminiInteractionRequest(
  model: string,
  input: GrantAnalysisInput,
) {
  return {
    model,
    input: buildGeminiGrantAnalysisPrompt(input),
    store: false,
    system_instruction: SYSTEM_INSTRUCTION,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: grantAnalysisJsonSchema(input.candidates.length),
    },
    generation_config: {
      max_output_tokens: MAX_OUTPUT_TOKENS,
    },
  };
}

type InteractionResponse = {
  status?: string;
  output_text?: string;
  errors?: unknown[];
  usage?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_thought_tokens?: number;
    total_tokens?: number;
  };
};

type GeminiInteractionsClient = {
  interactions: {
    create(
      params: Record<string, unknown>,
      options?: Record<string, unknown>,
    ): Promise<InteractionResponse>;
  };
};

type ProviderOptions = {
  apiKey?: string | null;
  model?: string;
  billingTier?: "free" | "paid";
  client?: GeminiInteractionsClient;
};

export function createGeminiGrantAnalysisProvider(
  options: ProviderOptions = {},
): GrantAnalysisProvider {
  const environment = getGeminiRuntimeConfig();
  const apiKey = options.apiKey === undefined ? environment.apiKey : options.apiKey;
  const model = options.model ?? environment.model;
  const billingTier = options.billingTier ?? environment.billingTier;

  return {
    id: "gemini",
    model,
    async analyze(input: GrantAnalysisInput): Promise<GrantAnalysisResponse> {
      if (!apiKey) throw new GeminiAnalysisError("GEMINI_API_KEY_MISSING");
      assertSyntheticGrantAnalysisInput(input);

      const startedAt = performance.now();
      try {
        const client = options.client ?? (await createClient(apiKey));
        const interaction = await client.interactions.create(
          buildGeminiInteractionRequest(model, input),
          { timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 },
        );

        if (
          interaction.status !== "completed" ||
          interaction.errors?.length ||
          !interaction.output_text
        ) {
          throw new GeminiAnalysisError("GEMINI_RESPONSE_INCOMPLETE");
        }

        const results = parseGeminiGrantAnalysisOutput(
          interaction.output_text,
          input,
        );
        const durationMs = elapsed(startedAt);
        const usage = interaction.usage;
        const inputTokens = nonNegativeInteger(usage?.total_input_tokens);
        const outputTokens = nonNegativeInteger(usage?.total_output_tokens);
        const thinkingTokens = nonNegativeInteger(usage?.total_thought_tokens);
        const totalTokens = nonNegativeInteger(
          usage?.total_tokens ?? inputTokens + outputTokens + thinkingTokens,
        );

        return {
          provider: "gemini",
          model,
          billingTier,
          inputTokens,
          outputTokens,
          thinkingTokens,
          totalTokens,
          durationMs,
          totalDurationMs: durationMs,
          estimatedCost: estimateGeminiCost(billingTier, {
            inputTokens,
            outputTokens,
            thinkingTokens,
          }),
          apiCalls: 1,
          results,
        };
      } catch (error) {
        if (error instanceof GeminiAnalysisError) throw error;
        throw mapGeminiProviderError(error, elapsed(startedAt));
      }
    },
  };
}

async function createClient(apiKey: string): Promise<GeminiInteractionsClient> {
  const { GoogleGenAI } = await import("@google/genai");
  return new GoogleGenAI({
    apiKey,
    httpOptions: { apiVersion: GEMINI_API_VERSION },
  }) as unknown as GeminiInteractionsClient;
}

function nonNegativeInteger(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : 0;
}

function elapsed(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 10) / 10;
}

const SYSTEM_INSTRUCTION = `당신은 AISUP 관리자 기술실험용 정부지원사업 심층분석기입니다.
제공된 후보 공고와 가상 테스트 프로필만 사용합니다. 새로운 공고, 금액, 날짜, 자격조건을 만들지 않습니다.
외부 검색, URL 조회, 도구 호출을 하지 않습니다. 신청 가능성을 확정하거나 보장하지 않습니다.
모르는 내용은 확인 필요로 처리하고, 근거가 없으면 강한 판정을 하지 않습니다.`;
