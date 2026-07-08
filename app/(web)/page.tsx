import AudienceEntryCards from "@/components/AudienceEntryCards";

export const dynamic = "force-dynamic";

// 첫 접속 화면 = 큰 카테고리 선택형 랜딩. 카드 클릭 시 /announcements 목록으로 진입.
export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-3xl bg-gradient-to-b from-primary-light/60 to-transparent px-6 py-14 text-center">
        <h1 className="text-2xl font-bold leading-snug text-ink sm:text-3xl">
          나에게 맞는 정부지원사업을 한눈에
        </h1>
        <p className="mt-3 text-sm text-slate-500 sm:text-base">
          창업, 사업, 취업 지원 공고를 쉽게 찾아보세요.
        </p>
      </section>

      <section className="mt-8">
        <AudienceEntryCards basePath="/announcements" active="all" params={{}} variant="landing" />
      </section>
    </div>
  );
}
