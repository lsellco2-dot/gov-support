import { AlertCircle } from "lucide-react";
import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-12">
      <section className="w-full rounded-lg border border-line bg-white p-6 text-center">
        <AlertCircle className="mx-auto text-urgent" size={32} aria-hidden="true" />
        <h1 className="mt-4 text-xl font-bold text-ink">로그인하지 못했습니다</h1>
        <p className="mt-2 text-sm leading-relaxed text-subtle">
          Google 로그인이 취소되었거나 인증 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          홈으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
