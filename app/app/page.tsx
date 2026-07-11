import AudienceEntryCards from "@/components/AudienceEntryCards";

export const dynamic = "force-dynamic";

// 모바일 WebView 첫 화면 = 랜딩. 카드 클릭 시 /app/announcements 목록으로 진입.
export default function AppHome() {
  return (
    <div>
      <section className="rounded-xl border border-line bg-white px-4 py-8 text-center">
        <p className="text-xs font-semibold text-primary">정부지원AI비서</p>
        <h1 className="mt-2 text-lg font-bold leading-snug text-ink">
          나에게 맞는 정부지원사업을 한눈에
        </h1>
        <p className="mt-2 text-xs leading-relaxed text-subtle">
          창업, 사업, 취업 지원 공고를 쉽게 찾아보세요.
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
