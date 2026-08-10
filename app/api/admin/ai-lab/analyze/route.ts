import { NextRequest, NextResponse } from "next/server";
import { loadCanonicalGrantAnalysisCandidates } from "@/lib/admin/ai-analysis/canonical-input";
import {
  createGeminiGrantAnalysisProvider,
  GeminiAnalysisError,
  type GeminiAnalysisErrorCode,
} from "@/lib/admin/ai-analysis/gemini-provider";
import { mockGrantAnalysisProvider } from "@/lib/admin/ai-analysis/mock-provider";
import {
  analyzeGrantCandidates,
  analyzeGrantCandidatesInBatches,
  GrantAnalysisBatchError,
} from "@/lib/admin/ai-analysis/provider";
import {
  parseGrantAnalysisRequest,
  type GrantAnalysisInput,
} from "@/lib/admin/ai-analysis/types";
import { runAiLabSearch } from "@/lib/admin/ai-lab-search";
import { getCurrentAdminAccess } from "@/lib/admin/auth";
import { adminAccessHttpStatus } from "@/lib/admin/auth-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request: NextRequest) {
  const requestStartedAt = performance.now();
  const access = await getCurrentAdminAccess();
  if (access.status !== "authorized") {
    return json(
      {
        error:
          access.status === "unauthenticated"
            ? "로그인이 필요합니다."
            : "관리자 권한이 필요합니다.",
      },
      adminAccessHttpStatus(access),
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
  }
  const parsed = parseGrantAnalysisRequest(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  try {
    // Re-run the existing server search so client-supplied IDs, scores, or titles
    // are never treated as canonical analysis input.
    const searchResult = await runAiLabSearch(parsed.value.search);
    const candidateById = new Map(
      searchResult.candidates.map((candidate) => [candidate.id, candidate]),
    );
    const candidates = parsed.value.candidateIds.flatMap((id) => {
      const candidate = candidateById.get(id);
      return candidate ? [candidate] : [];
    });
    if (candidates.length !== parsed.value.candidateIds.length) {
      return json(
        { error: "후보 공고가 변경되었습니다. 정밀검색을 다시 실행해 주세요." },
        409,
      );
    }

    const analysisCandidates =
      parsed.value.provider === "gemini"
        ? await loadCanonicalGrantAnalysisCandidates(candidates)
        : candidates.map((candidate) => ({
            ...candidate,
            target: null,
            supportType: null,
            summary: null,
            detailContent: null,
            applyMethod: null,
            documents: null,
            contentTruncated: false,
          }));
    const analysisInput: GrantAnalysisInput = {
      profile: searchResult.input.profile,
      businessItemDescription:
        searchResult.input.profile.business_item_description,
      neededSupport: searchResult.input.profile.needed_support,
      candidates: analysisCandidates,
    };
    const provider =
      parsed.value.provider === "gemini"
        ? createGeminiGrantAnalysisProvider()
        : mockGrantAnalysisProvider;
    const result =
      parsed.value.provider === "gemini"
        ? await analyzeGrantCandidatesInBatches(provider, analysisInput)
        : await analyzeGrantCandidates(provider, analysisInput);
    return json(
      {
        ...result,
        totalDurationMs: elapsed(requestStartedAt),
      },
      200,
    );
  } catch (error) {
    if (error instanceof GrantAnalysisBatchError) {
      const batch = {
        successfulBatches: error.successfulBatches,
        failedBatch: error.failedBatch,
        totalBatches: error.batchSizes.length,
        batchSizes: error.batchSizes,
      };
      if (error.batchCause instanceof GeminiAnalysisError) {
        const mapped = geminiErrorResponse(error.batchCause);
        return json(
          {
            ...mapped.body,
            error: "AI 정밀분석 부분 실패",
            batch,
          },
          mapped.status,
        );
      }
      console.error("admin AI lab batch analysis failed");
      return json({ error: "AI 정밀분석 부분 실패", batch }, 500);
    }
    if (error instanceof GeminiAnalysisError) {
      const mapped = geminiErrorResponse(error);
      return json(mapped.body, mapped.status);
    }
    console.error("admin AI lab analysis failed");
    return json(
      { error: "AI 정밀분석을 실행하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      500,
    );
  }
}

function geminiErrorResponse(error: GeminiAnalysisError) {
  const code = error.code;
  const messages: Record<GeminiAnalysisErrorCode, string> = {
    GEMINI_API_KEY_MISSING: "Gemini API 키가 설정되지 않았습니다.",
    GEMINI_SENSITIVE_INPUT_REJECTED:
      "가상 프로필에 이메일, 전화번호 또는 사업자등록번호 형식이 포함되어 있습니다.",
    GEMINI_INVALID_REQUEST: "Gemini 요청 형식이 올바르지 않습니다.",
    GEMINI_PARAMETER_UNKNOWN: "Gemini가 지원하지 않는 요청 항목이 포함되어 있습니다.",
    GEMINI_FAILED_PRECONDITION: "Gemini 요청의 사전 조건을 충족하지 못했습니다.",
    GEMINI_AUTH_FAILED: "Gemini API 인증에 실패했습니다. 키 설정을 확인해 주세요.",
    GEMINI_PERMISSION_DENIED: "Gemini API 프로젝트에 요청 권한이 없습니다.",
    GEMINI_MODEL_NOT_FOUND: "설정한 Gemini 모델을 찾을 수 없습니다.",
    GEMINI_NOT_FOUND: "Gemini API 요청 대상을 찾을 수 없습니다.",
    GEMINI_RATE_LIMIT_EXCEEDED: "Gemini API 호출 빈도 제한에 도달했습니다.",
    GEMINI_QUOTA_EXCEEDED: "Gemini API 사용 한도에 도달했습니다.",
    GEMINI_CANCELLED: "Gemini 요청이 취소되었습니다.",
    GEMINI_API_ERROR: "Gemini API 내부 오류가 발생했습니다.",
    GEMINI_SERVICE_UNAVAILABLE: "Gemini 서비스를 일시적으로 사용할 수 없습니다.",
    GEMINI_DEADLINE_EXCEEDED: "Gemini 서버 처리 제한시간을 초과했습니다.",
    GEMINI_CLIENT_TIMEOUT: "Gemini 응답 대기시간 25초를 초과했습니다.",
    FREE_TIER_LIMIT_REACHED:
      "Gemini Free Tier 사용 한도에 도달했습니다. 이번 실험을 중단합니다.",
    GEMINI_TIMEOUT: "Gemini 응답 시간이 초과되었습니다.",
    GEMINI_NETWORK_ERROR: "Gemini API에 연결하지 못했습니다.",
    GEMINI_SERVICE_ERROR: "Gemini 서비스 오류로 분석하지 못했습니다.",
    GEMINI_STRUCTURED_OUTPUT_ERROR:
      "Gemini 응답이 정밀분석 결과 형식과 일치하지 않습니다.",
    GEMINI_RESPONSE_INCOMPLETE: "Gemini가 일부 후보 결과를 반환하지 않았습니다.",
  };
  const status =
    code === "GEMINI_SENSITIVE_INPUT_REJECTED"
      ? 400
      : code === "FREE_TIER_LIMIT_REACHED" ||
          code === "GEMINI_RATE_LIMIT_EXCEEDED" ||
          code === "GEMINI_QUOTA_EXCEEDED"
        ? 429
        : code === "GEMINI_TIMEOUT" ||
            code === "GEMINI_CLIENT_TIMEOUT" ||
            code === "GEMINI_DEADLINE_EXCEEDED"
          ? 504
          : code === "GEMINI_API_KEY_MISSING" ||
              code === "GEMINI_NETWORK_ERROR" ||
              code === "GEMINI_SERVICE_ERROR"
            ? 503
            : 502;
  return {
    status,
    body: {
      error: messages[code],
      code,
      ...(error.diagnostics ? { diagnostics: error.diagnostics } : {}),
    },
  };
}

function elapsed(startedAt: number) {
  return Math.round((performance.now() - startedAt) * 10) / 10;
}

function json(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
