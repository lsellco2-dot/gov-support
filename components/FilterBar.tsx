import { CATEGORIES, REGIONS } from "@/lib/query/announcements";

// GET 폼 기반 필터: JS 없이 동작 → WebView에서도 안정적
export default function FilterBar({
  action,
  defaults,
}: {
  action: string;
  defaults: { q?: string; audience?: string; category?: string; region?: string; status?: string; sort?: string };
}) {
  const selectClass =
    "h-11 max-w-full rounded-lg border border-line bg-white px-3 text-sm text-ink focus:border-primary";
  return (
    <form
      action={action}
      method="get"
      className="rounded-lg border border-line bg-white p-4"
    >
      {defaults.audience && <input type="hidden" name="audience" value={defaults.audience} />}

      {/* 검색어 + 검색 버튼 */}
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-subtle">
            🔍
          </span>
          <label htmlFor="q" className="sr-only">공고명 검색</label>
          <input
            id="q"
            type="search"
            name="q"
            defaultValue={defaults.q ?? ""}
            placeholder="공고명 검색 (예: 스마트공장)"
            className="h-11 w-full rounded-lg border border-line bg-white pl-9 pr-3 text-sm text-ink focus:border-primary"
          />
        </div>
        <button
          type="submit"
          className="h-11 shrink-0 rounded-md bg-primary px-5 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          검색
        </button>
      </div>

      {/* 보조 필터 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <label htmlFor="category" className="sr-only">지원분야</label>
        <select id="category" name="category" defaultValue={defaults.category ?? ""} className={selectClass}>
          <option value="">전체 분야</option>
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label htmlFor="region" className="sr-only">지역</label>
        <select id="region" name="region" defaultValue={defaults.region ?? ""} className={selectClass}>
          <option value="">전체 지역</option>
          {REGIONS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <label htmlFor="status" className="sr-only">모집상태</label>
        <select id="status" name="status" defaultValue={defaults.status ?? "open"} className={selectClass}>
          <option value="open">모집중</option>
          <option value="closed">마감</option>
          <option value="all">전체</option>
        </select>
        <label htmlFor="sort" className="sr-only">정렬</label>
        <select id="sort" name="sort" defaultValue={defaults.sort ?? "latest"} className={selectClass}>
          <option value="latest">최신 등록순</option>
          <option value="deadline">마감 임박순</option>
        </select>
      </div>
    </form>
  );
}
