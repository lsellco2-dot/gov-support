import AppRecommendationsPage from "@/components/AppRecommendationsPage";

export default function RecommendationsPage() {
  return (
    <section>
      <h1 className="text-lg font-bold text-ink">AI추천</h1>
      <p className="mt-1 mb-4 text-xs leading-relaxed text-subtle">
        내 정보와 공개 공고를 규칙으로 비교한 참고용 추천입니다. 실제 지원 자격은 공고 원문에서 확인해 주세요.
      </p>
      <AppRecommendationsPage />
    </section>
  );
}
