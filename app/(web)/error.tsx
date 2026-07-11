"use client";

// (web) 세그먼트 공통 에러 화면 — DB 연결 실패 등
export default function ErrorPage({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-lg border border-slate-200 bg-white p-8 text-center">
      <p className="text-3xl">⚠️</p>
      <h2 className="mt-3 text-lg font-bold text-ink">공고를 불러오지 못했습니다</h2>
      <p className="mt-2 text-sm text-slate-500">
        일시적인 오류일 수 있습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <button
        onClick={reset}
        className="mt-5 h-10 rounded-md bg-primary px-6 text-sm font-semibold text-white hover:bg-primary-dark"
      >
        다시 시도
      </button>
    </div>
  );
}
