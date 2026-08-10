import {
  GeminiAnalysisError,
  type GeminiAnalysisErrorCode,
} from "@/lib/admin/ai-analysis/gemini-contract";
import type { GeminiErrorDiagnostics } from "@/lib/admin/ai-analysis/types";

const MAX_SAFE_MESSAGE_LENGTH = 320;

export function mapGeminiProviderError(
  error: unknown,
  durationMs: number,
): GeminiAnalysisError {
  const diagnostics = extractGeminiErrorDiagnostics(error, durationMs);
  return new GeminiAnalysisError(classifyGeminiError(diagnostics), diagnostics);
}

export function extractGeminiErrorDiagnostics(
  error: unknown,
  durationMs: number,
): GeminiErrorDiagnostics {
  const record = asRecord(error);
  const parsedBody = parseJsonRecord(record.body);
  const parsedMessage = parseJsonRecord(record.message);
  const nested = firstRecord(
    record.error,
    asRecord(parsedBody.error),
    asRecord(parsedMessage.error),
    parsedBody,
    parsedMessage,
  );
  const rawName = firstString(record.name, nested.name) || "Error";
  const rawMessage =
    firstString(nested.message, record.message) || "Gemini 요청에 실패했습니다.";
  const httpStatus = firstHttpStatus(
    record.status,
    record.statusCode,
    nested.status,
    nested.statusCode,
    nested.code,
  );
  const sourceCode = firstString(
    record.code,
    nested.status,
    nested.code,
    nested.errorCode,
  );
  const normalizedName = safeIdentifier(rawName, "Error");
  const normalizedMessage = sanitizeGeminiErrorMessage(rawMessage);
  const lowerName = normalizedName.toLowerCase();
  const lowerMessage = normalizedMessage.toLowerCase();
  const lowerCode = (sourceCode || "").toLowerCase();
  const timedOut =
    httpStatus === 408 ||
    httpStatus === 504 ||
    lowerName.includes("timeout") ||
    lowerMessage.includes("timed out") ||
    lowerMessage.includes("timeout") ||
    lowerCode.includes("deadline_exceeded");
  const aborted =
    httpStatus === 499 ||
    lowerName.includes("abort") ||
    lowerMessage.includes("aborted") ||
    lowerCode.includes("cancelled");

  return {
    httpStatus,
    googleCode: normalizeGoogleCode(
      sourceCode,
      httpStatus,
      normalizedMessage,
      timedOut,
      aborted,
    ),
    errorName: normalizedName,
    safeMessage: normalizedMessage,
    timedOut,
    aborted,
    durationMs: Math.max(0, Math.round(durationMs * 10) / 10),
  };
}

export function classifyGeminiError(
  diagnostics: GeminiErrorDiagnostics,
): GeminiAnalysisErrorCode {
  const { httpStatus, googleCode, timedOut, aborted } = diagnostics;
  if (googleCode === "client_timeout") return "GEMINI_CLIENT_TIMEOUT";
  if (timedOut && httpStatus === 504) return "GEMINI_DEADLINE_EXCEEDED";
  if (timedOut) return "GEMINI_CLIENT_TIMEOUT";
  if (aborted || httpStatus === 499) return "GEMINI_CANCELLED";

  if (httpStatus === 400) {
    if (googleCode === "parameter_unknown") return "GEMINI_PARAMETER_UNKNOWN";
    if (googleCode === "failed_precondition") {
      return "GEMINI_FAILED_PRECONDITION";
    }
    return "GEMINI_INVALID_REQUEST";
  }
  if (httpStatus === 401) return "GEMINI_AUTH_FAILED";
  if (httpStatus === 403) return "GEMINI_PERMISSION_DENIED";
  if (httpStatus === 404) {
    return googleCode === "model_not_found"
      ? "GEMINI_MODEL_NOT_FOUND"
      : "GEMINI_NOT_FOUND";
  }
  if (httpStatus === 429) {
    return googleCode === "quota_exceeded"
      ? "GEMINI_QUOTA_EXCEEDED"
      : "GEMINI_RATE_LIMIT_EXCEEDED";
  }
  if (httpStatus === 500) return "GEMINI_API_ERROR";
  if (httpStatus === 503) return "GEMINI_SERVICE_UNAVAILABLE";
  if (httpStatus === 504) return "GEMINI_DEADLINE_EXCEEDED";
  if (googleCode === "network_error") return "GEMINI_NETWORK_ERROR";
  return "GEMINI_SERVICE_ERROR";
}

export function sanitizeGeminiErrorMessage(value: string) {
  return value
    .replace(/([?&](?:key|api_key|access_token|token)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(/\b(?:AIza[A-Za-z0-9_-]{20,}|AQ\.[A-Za-z0-9._-]{20,})\b/g, "[REDACTED]")
    .replace(/(authorization\s*:\s*bearer\s+)\S+/gi, "$1[REDACTED]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[EMAIL REDACTED]")
    .replace(/(?:01[016789])[-\s]?\d{3,4}[-\s]?\d{4}/g, "[PHONE REDACTED]")
    .replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{5}\b/g, "[ID REDACTED]")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SAFE_MESSAGE_LENGTH);
}

function normalizeGoogleCode(
  sourceCode: string | null,
  httpStatus: number | null,
  message: string,
  timedOut: boolean,
  aborted: boolean,
) {
  const code = (sourceCode || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const lowerMessage = message.toLowerCase();
  if (timedOut && httpStatus === null) return "client_timeout";
  if (aborted && httpStatus === null) return "cancelled";
  if (lowerMessage.includes("unknown parameter")) return "parameter_unknown";
  if (code.includes("failed_precondition")) return "failed_precondition";
  if (httpStatus === 400 || code.includes("invalid_argument")) return "invalid_request";
  if (httpStatus === 401 || code.includes("unauthenticated")) return "authentication";
  if (httpStatus === 403 || code.includes("permission_denied")) return "permission_denied";
  if (httpStatus === 404) {
    return lowerMessage.includes("model") ? "model_not_found" : "not_found";
  }
  if (httpStatus === 429) {
    return code.includes("quota") || lowerMessage.includes("quota")
      ? "quota_exceeded"
      : "rate_limit_exceeded";
  }
  if (httpStatus === 499 || code.includes("cancelled")) return "cancelled";
  if (httpStatus === 500) return "api_error";
  if (httpStatus === 503) return "service_unavailable";
  if (httpStatus === 504 || code.includes("deadline_exceeded")) {
    return "deadline_exceeded";
  }
  if (code) return safeIdentifier(code, "unknown").toLowerCase();
  if (lowerMessage.includes("connection") || lowerMessage.includes("fetch failed")) {
    return "network_error";
  }
  return "unknown";
}

function firstHttpStatus(...values: unknown[]) {
  for (const value of values) {
    const status = Number(value);
    if (Number.isInteger(status) && status >= 100 && status <= 599) return status;
  }
  return null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function firstRecord(...values: unknown[]) {
  for (const value of values) {
    const record = asRecord(value);
    if (Object.keys(record).length) return record;
  }
  return {};
}

function parseJsonRecord(value: unknown) {
  if (typeof value !== "string" || value.length > 20_000) return {};
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
}

function safeIdentifier(value: string, fallback: string) {
  const safe = value.replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 80);
  return safe || fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
