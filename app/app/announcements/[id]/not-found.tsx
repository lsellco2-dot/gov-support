import Link from "next/link";

export default function AppAnnouncementNotFound() {
  return (
    <div className="mt-8 rounded-lg border border-line bg-white p-6 text-center">
      <h1 className="text-base font-bold text-ink">공고를 찾을 수 없습니다</h1>
      <p className="mt-2 text-xs leading-relaxed text-subtle">
        삭제되었거나 주소가 잘못된 공고입니다. 공고 목록에서 다시 확인해 주세요.
      </p>
      <Link
        href="/app/announcements"
        className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-md bg-primary text-sm font-semibold text-white"
      >
        공고 목록으로
      </Link>
    </div>
  );
}
