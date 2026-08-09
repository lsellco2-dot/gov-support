import { NextRequest, NextResponse } from "next/server";
import { runAiLabSearch } from "@/lib/admin/ai-lab-search";
import { parseAiLabSearchInput } from "@/lib/admin/ai-lab-types";
import { getCurrentAdminAccess } from "@/lib/admin/auth";
import { adminAccessHttpStatus } from "@/lib/admin/auth-policy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
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
  const parsed = parseAiLabSearchInput(body);
  if (!parsed.ok) return json({ error: parsed.error }, 400);

  try {
    const result = await runAiLabSearch(parsed.value);
    return json(result, 200);
  } catch {
    console.error("admin AI lab search failed");
    return json(
      { error: "정밀검색 후보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." },
      500,
    );
  }
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
