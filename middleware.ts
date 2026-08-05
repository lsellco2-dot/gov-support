import type { NextRequest } from "next/server";
import { updateAuthSession } from "@/lib/supabase/auth-middleware";

export async function middleware(request: NextRequest) {
  return updateAuthSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
