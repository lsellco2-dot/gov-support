import AppFavoritesPage from "@/components/AppFavoritesPage";

export default function FavoritesPage() {
  return (
    <section>
      <h1 className="text-lg font-bold text-ink">즐겨찾기</h1>
      <p className="mt-1 mb-4 text-xs leading-relaxed text-subtle">
        이 기기에 저장한 공고를 최신 저장순으로 확인합니다.
      </p>
      <AppFavoritesPage />
    </section>
  );
}
