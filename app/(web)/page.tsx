import AudienceEntryCards from "@/components/AudienceEntryCards";

export const dynamic = "force-dynamic";

// 첫 접속 화면 = 큰 카테고리 선택형 랜딩. 카드 클릭 시 /announcements 목록으로 진입.
export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-2xl border border-line bg-white px-6 py-14 text-center">
        <p className="text-base font-semibold text-primary">정부지원AI비서</p>
        <h1 className="mt-3 text-2xl font-bold leading-snug text-ink sm:text-3xl">
          AI 맞춤 설정하기
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-subtle sm:text-base">
          나에게 맞는 맞춤 공고를 설정하세요.
        </p>
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
