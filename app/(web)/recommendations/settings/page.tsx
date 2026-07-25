import WebUserConditionForm from "@/components/WebUserConditionForm";

export default function WebRecommendationSettingsPage() {
  return (
    <section className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-bold text-ink">내 정보 설정</h1>
      <p className="mt-2 mb-5 text-sm leading-relaxed text-subtle">
        입력한 정보는 이 브라우저에만 저장되며 서버로 전송되지 않습니다.
      </p>
      <WebUserConditionForm />
    </section>
  );
}
