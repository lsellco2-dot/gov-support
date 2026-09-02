import AudienceEntryCards from "@/components/AudienceEntryCards";
import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "정부지원사업 공고 통합조회·AI 맞춤 추천",
  description:
    "창업·소상공인·취업·청년 대상 정부지원사업 공고를 한곳에서 찾고 AI 맞춤 추천으로 확인하세요.",
  alternates: { canonical: "/" },
};

// 첫 접속 화면 = 큰 카테고리 선택형 랜딩. 카드 클릭 시 /announcements 목록으로 진입.
export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-2xl border border-line bg-white px-6 py-14 text-center">
        <p className="text-base font-semibold text-primary">정부지원AI비서</p>
        <h1 className="mt-3 text-2xl font-bold leading-snug text-ink sm:text-3xl">
          정부지원사업 AI 맞춤 설정하기
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-subtle sm:text-base">
          나에게 맞는 정부지원사업 공고를 설정하세요.
        </p>
        <Link
          href="/recommendations"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-dark"
        >
          AI추천 시작하기
        </Link>
      </section>

      <section className="mt-10">
        <h2 className="text-base font-bold text-ink">
          무엇을 찾으시나요?
        </h2>
        <p className="mt-1 text-sm text-subtle">대상을 선택하면 맞춤 공고 목록으로 이동합니다.</p>
        <div className="mt-4">
          <AudienceEntryCards basePath="/announcements" active="all" params={{}} variant="landing" />
        </div>
      </section>
    </div>
  );
}
