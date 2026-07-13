import AudienceEntryCards from "@/components/AudienceEntryCards";
import AppSettingsEntry from "@/components/AppSettingsEntry";

export const dynamic = "force-dynamic";

// 모바일 WebView 첫 화면 = 랜딩. 카드 클릭 시 /app/announcements 목록으로 진입.
export default function AppHome() {
  return (
    <div>
      <AppSettingsEntry />

      <section className="mt-6">
        <h2 className="text-sm font-bold text-ink">무엇을 찾으시나요?</h2>
        <div className="mt-3">
          <AudienceEntryCards basePath="/app/announcements" active="all" params={{}} variant="landing" />
        </div>
      </section>
    </div>
  );
}
