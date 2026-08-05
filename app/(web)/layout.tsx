import AuthControl from "@/components/AuthControl";
import { createAuthServerClient } from "@/lib/supabase/auth-server";
import Link from "next/link";

export default async function WebLayout({ children }: { children: React.ReactNode }) {
  const supabase = createAuthServerClient();
  const { data } = supabase ? await supabase.auth.getClaims() : { data: null };
  const claims = data?.claims;
  const userMetadata = claims?.user_metadata as
    | { full_name?: string; name?: string }
    | undefined;
  const user = claims
    ? {
        email: typeof claims.email === "string" ? claims.email : null,
        // Metadata is display-only and is never used for authorization.
        displayName: userMetadata?.full_name ?? userMetadata?.name ?? null,
      }
    : null;

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-primary">
            <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-white">정</span>
            정부지원AI비서
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-subtle lg:inline">
              중기부 · 창진원 · 행안부 · 과기부 공고 통합조회
            </span>
            <AuthControl user={user} />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      <footer className="mt-10 border-t border-line bg-white py-6 text-center text-xs text-slate-400">
        <p>본 서비스의 공고 정보는 공공데이터포털(data.go.kr) 공개 API를 통해 수집되었습니다.</p>
        <p className="mt-1">정확한 내용은 반드시 각 공고의 원문을 확인하세요.</p>
        <p className="mt-3 space-x-3">
          <Link href="/privacy" className="text-subtle underline-offset-2 hover:underline">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="text-subtle underline-offset-2 hover:underline">
            이용약관
          </Link>
        </p>
      </footer>
    </div>
  );
}
