import AppRecommendationsPage from "@/components/AppRecommendationsPage";

export default function WebRecommendationsPage({
  searchParams,
}: {
  searchParams?: { saved?: string; cleared?: string };
}) {
  const notice =
    searchParams?.saved === "1"
      ? "내 정보를 저장했습니다."
      : searchParams?.cleared === "1"
        ? "저장된 내 정보를 삭제했습니다."
        : null;

  return (
    <section className="mx-auto max-w-4xl">
      <h1 className="text-2xl font-bold text-ink">AI추천</h1>
      <p className="mt-2 mb-5 text-sm leading-relaxed text-subtle">
        내 정보와 공개 공고를 규칙으로 비교한 참고용 추천입니다. 실제 지원 자격은 공고 원문에서 확인해 주세요.
      </p>
      <AppRecommendationsPage
        detailBasePath="/announcements"
        settingsPath="/recommendations/settings"
        notice={notice}
      />
    </section>
  );
}
