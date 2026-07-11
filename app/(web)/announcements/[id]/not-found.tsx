import Link from "next/link";

export default function AnnouncementNotFound() {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-lg border border-line bg-white p-8 text-center">
      <h1 className="text-lg font-bold text-ink">공고를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm leading-relaxed text-subtle">
        삭제되었거나 주소가 잘못된 공고입니다. 공고 목록에서 다시 확인해 주세요.
      </p>
      <Link
        href="/announcements"
        className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-dark"
      >
        공고 목록으로
      </Link>
    </div>
  );
}
