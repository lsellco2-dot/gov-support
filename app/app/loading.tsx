// 목록/상세 로딩 중 스켈레톤 (모바일 WebView)
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="flex flex-wrap gap-2">
        <div className="h-10 w-full animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="mt-3 space-y-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="h-5 w-4/5 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-3/5 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
