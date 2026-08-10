import "server-only";

import { GEMINI_PRICING } from "@/lib/admin/ai-analysis/gemini-runtime";
import type { GeminiAnalysisAvailability } from "@/lib/admin/ai-analysis/types";

export const DEFAULT_GEMINI_MODEL = GEMINI_PRICING.modelId;

export function getGeminiAnalysisAvailability(): GeminiAnalysisAvailability {
  const config = getGeminiRuntimeConfig();
  return {
    configured: Boolean(config.apiKey),
    model: config.model,
    billingTier: config.billingTier,
  };
}

export function getGeminiRuntimeConfig() {
  const apiKey = process.env.GEMINI_API_KEY?.trim() || null;
  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  const billingTier =
    process.env.GEMINI_BILLING_TIER?.trim().toLowerCase() === "paid"
      ? "paid"
      : "free";

  return { apiKey, model, billingTier } as const;
}
