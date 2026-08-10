import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import AiLabClient from "@/components/admin/AiLabClient";
import { getGeminiAnalysisAvailability } from "@/lib/admin/ai-analysis/gemini-config";
import { requireAdminPage } from "@/lib/admin/auth";

export const metadata: Metadata = {
  title: "정밀검색 실험실 · AISUP 관리자",
  robots: { index: false, follow: false },
};

export default async function AiLabPage() {
  const access = await requireAdminPage("/admin/ai-lab");
  const gemini = getGeminiAnalysisAvailability();
  return (
    <main className="min-h-screen bg-[var(--bg)] px-3 py-5 sm:px-4 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="inline-flex h-9 items-center text-sm font-semibold text-primary">
              <ChevronLeft className="mr-1" size={17} aria-hidden="true" />
              관리자 홈
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">정밀검색 실험실</h1>
            <p className="mt-2 text-sm leading-relaxed text-subtle">
              AISUP의 현재 규칙 검색 결과를 확인하고, 다음 LLM 심층판단 단계의 후보군을 검증합니다.
            </p>
          </div>
          <p className="text-xs text-subtle">
            관리자 · {access.user.email ?? access.user.displayName ?? "Google 사용자"}
          </p>
        </header>
        <AiLabClient gemini={gemini} />
      </div>
    </main>
  );
}
