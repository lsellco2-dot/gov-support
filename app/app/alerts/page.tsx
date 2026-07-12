import AppAlertsPage from "@/components/AppAlertsPage";

export default function AlertsPage() {
  return (
    <section>
      <h1 className="text-lg font-bold text-ink">내 알림</h1>
      <p className="mt-1 mb-4 text-xs leading-relaxed text-subtle">
        이 기기에서 알림을 설정한 공고를 확인합니다.
      </p>
      <AppAlertsPage />
    </section>
  );
}
