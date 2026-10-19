import Link from "next/link";
import type { Metadata } from "next";
import AppBottomNav from "@/components/AppBottomNav";
import AuthControl from "@/components/AuthControl";
import OperatorInfo from "@/components/OperatorInfo";
import { createAuthServerClient } from "@/lib/supabase/auth-server";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Android WebView가 로드하는 모바일 전용 레이아웃
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createAuthServerClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const claims = data?.claims;
  const userMetadata = claims?.user_metadata as
    | { full_name?: string; name?: string }
    | undefined;
  const user = claims
    ? {
        email: typeof claims.email === "string" ? claims.email : null,
        displayName: userMetadata?.full_name ?? userMetadata?.name ?? null,
      }
    : null;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[var(--bg)] pb-[calc(4.25rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="relative flex h-12 items-center justify-center px-3">
          <Link href="/app" className="text-base font-bold text-primary">
            정부지원AI비서
          </Link>
          <div className="absolute right-3 top-1.5">
            <AuthControl user={user} compact />
          </div>
        </div>
      </header>
      <main className="px-3 py-4">
        {children}
        <footer className="mt-8 space-y-3 pb-2 text-center text-xs leading-6 text-subtle">
          <OperatorInfo />
          <p>
            <Link href="/privacy" className="underline-offset-2 hover:underline">
              개인정보처리방침
            </Link>
            <span className="mx-2">·</span>
            <Link href="/terms" className="underline-offset-2 hover:underline">
              이용약관
            </Link>
          </p>
          <p><Link href="/terms" className="underline underline-offset-2">이용약관 개정 안내 · 2026.11.18 적용</Link></p>
        </footer>
      </main>
      <AppBottomNav />
    </div>
  );
}
