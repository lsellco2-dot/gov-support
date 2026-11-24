import { NextResponse } from "next/server";
import { getCurrentAdminAccess } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

// 공개 페이지는 캐시(ISR)되므로 로그인 상태는 브라우저가 여기서 따로 가져간다.
export async function GET() {
  const access = await getCurrentAdminAccess();
  const user = access.user
    ? { email: access.user.email, displayName: access.user.displayName }
    : null;

  return NextResponse.json(
    { user, isAdmin: access.status === "authorized" },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
