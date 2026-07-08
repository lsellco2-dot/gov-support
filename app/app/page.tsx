import AudienceEntryCards from "@/components/AudienceEntryCards";

export const dynamic = "force-dynamic";

// 모바일 WebView 첫 화면 = 랜딩. 카드 클릭 시 /app/announcements 목록으로 진입.
export default function AppHome() {
  return (
    <div>
      <section className="rounded-2xl bg-gradient-to-b from-primary-light/60 to-transparent px-4 py-8 text-center">
        <h1 className="text-lg font-bold leading-snug text-ink">
          나에게 맞는 정부지원사업을 한눈에
        </h1>
        <p className="mt-2 text-xs text-slate-500">
          창업, 사업, 취업 지원 공고를 쉽게 찾아보세요.
        </p>
      </section>

      <section className="mt-5">
        <AudienceEntryCards basePath="/app/announcements" active="all" params={{}} variant="landing" />
      </section>
    </div>
  );
}
