export const GEMINI_API_VERSION = "v1";

export const GEMINI_PRICING = {
  modelId: "gemini-3.5-flash-lite",
  effectiveDate: "2026-08-09",
  paidInputUsdPerMillionTokens: 0.3,
  paidOutputUsdPerMillionTokens: 2.5,
} as const;

export function estimateGeminiCost(
  billingTier: "free" | "paid",
  usage: {
    inputTokens: number;
    outputTokens: number;
    thinkingTokens: number;
  },
) {
  if (billingTier === "free") {
    return { amount: 0, currency: "USD" as const };
  }

  const inputCost =
    (usage.inputTokens / 1_000_000) *
    GEMINI_PRICING.paidInputUsdPerMillionTokens;
  const outputCost =
    ((usage.outputTokens + usage.thinkingTokens) / 1_000_000) *
    GEMINI_PRICING.paidOutputUsdPerMillionTokens;

  return { amount: inputCost + outputCost, currency: "USD" as const };
}
