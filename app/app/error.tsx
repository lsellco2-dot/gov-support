"use client";

// /app 세그먼트 공통 에러 화면 (모바일 WebView)
export default function ErrorPage({
  reset,
}: {
  reset: () => void;
}) {
  return (
    <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 text-center">
      <p className="text-2xl">⚠️</p>
      <h2 className="mt-2 text-base font-bold text-ink">공고를 불러오지 못했습니다</h2>
      <p className="mt-1 text-xs text-slate-500">일시적인 오류일 수 있습니다. 다시 시도해 주세요.</p>
      <button
        onClick={reset}
        className="mt-4 h-10 w-full rounded-md bg-primary text-sm font-semibold text-white"
      >
        다시 시도
      </button>
    </div>
  );
}
