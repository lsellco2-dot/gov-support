import assert from "node:assert/strict";
import test from "node:test";
import {
  extractGeminiErrorDiagnostics,
  mapGeminiProviderError,
  sanitizeGeminiErrorMessage,
} from "@/lib/admin/ai-analysis/gemini-error";

test("Gemini 400 unknown parameter is preserved without secrets", () => {
  const mapped = mapGeminiProviderError(
    {
      status: 400,
      name: "BadRequestError",
      message:
        "Unknown parameter 'response_format.example'. URL ?key=AQ.abcdefghijklmnopqrstuvwxyz1234567890",
      error: { status: "INVALID_ARGUMENT" },
    },
    123.45,
  );

  assert.equal(mapped.code, "GEMINI_PARAMETER_UNKNOWN");
  assert.equal(mapped.diagnostics?.httpStatus, 400);
  assert.equal(mapped.diagnostics?.googleCode, "parameter_unknown");
  assert.equal(mapped.diagnostics?.errorName, "BadRequestError");
  assert.equal(mapped.diagnostics?.durationMs, 123.5);
  assert.doesNotMatch(mapped.diagnostics?.safeMessage ?? "", /AQ\./);
});

test("Gemini statusCode and nested quota response are classified", () => {
  const mapped = mapGeminiProviderError(
    {
      statusCode: 429,
      body: JSON.stringify({
        error: {
          code: 429,
          status: "RESOURCE_EXHAUSTED",
          message: "Quota exceeded for free tier",
        },
      }),
    },
    10,
  );

  assert.equal(mapped.code, "GEMINI_QUOTA_EXCEEDED");
  assert.equal(mapped.diagnostics?.httpStatus, 429);
  assert.equal(mapped.diagnostics?.googleCode, "quota_exceeded");
});

test("Google GenAI ApiError JSON message exposes status and safe detail", () => {
  const mapped = mapGeminiProviderError(
    {
      name: "ApiError",
      status: 400,
      message: JSON.stringify({
        error: {
          code: 400,
          status: "INVALID_ARGUMENT",
          message: "Unknown parameter 'response_format.example'",
        },
      }),
    },
    42,
  );

  assert.equal(mapped.code, "GEMINI_PARAMETER_UNKNOWN");
  assert.equal(mapped.diagnostics?.httpStatus, 400);
  assert.equal(mapped.diagnostics?.googleCode, "parameter_unknown");
  assert.equal(
    mapped.diagnostics?.safeMessage,
    "Unknown parameter 'response_format.example'",
  );
});

test("client timeout and abort remain distinguishable", () => {
  const timeout = extractGeminiErrorDiagnostics(
    { name: "APIConnectionTimeoutError", message: "Request timed out" },
    25_000,
  );
  assert.equal(timeout.timedOut, true);
  assert.equal(timeout.googleCode, "client_timeout");
  assert.equal(mapGeminiProviderError({ name: "AbortError" }, 20).code, "GEMINI_CANCELLED");
});

test("safe Gemini messages redact credentials and personal identifiers", () => {
  const message = sanitizeGeminiErrorMessage(
    "Authorization: Bearer secret-value test@example.com 010-1234-5678 123-45-67890",
  );
  assert.doesNotMatch(message, /secret-value|test@example|010-1234|123-45-67890/);
  assert.ok(message.length <= 320);
});
