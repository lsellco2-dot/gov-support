// 목록/상세 로딩 중 스켈레톤 (PC)
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="불러오는 중">
      <div className="flex flex-wrap gap-2">
        <div className="h-10 flex-1 basis-52 animate-pulse rounded-md bg-slate-200" />
        <div className="h-10 w-28 animate-pulse rounded-md bg-slate-200" />
        <div className="h-10 w-28 animate-pulse rounded-md bg-slate-200" />
        <div className="h-10 w-20 animate-pulse rounded-md bg-slate-200" />
      </div>
      <div className="mt-4 h-4 w-24 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="h-5 w-4/5 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-3/5 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 flex gap-1">
              <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
