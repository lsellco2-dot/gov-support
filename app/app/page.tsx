import AudienceEntryCards from "@/components/AudienceEntryCards";

export const dynamic = "force-dynamic";

// 모바일 WebView 첫 화면 = 랜딩. 카드 클릭 시 /app/announcements 목록으로 진입.
export default function AppHome() {
  return (
    <div>
      <section className="rounded-xl border border-line bg-white px-4 py-8 text-center">
        <p className="text-base font-semibold text-primary">정부지원AI비서</p>
        <h1 className="mt-2 text-2xl font-bold leading-snug text-ink sm:text-3xl">
          AI 맞춤 설정하기
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-subtle sm:text-base">
          나에게 맞는 맞춤 공고를 설정하세요.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-bold text-ink">무엇을 찾으시나요?</h2>
        <div className="mt-3">
          <AudienceEntryCards basePath="/app/announcements" active="all" params={{}} variant="landing" />
        </div>
      </section>
    </div>
  );
}
