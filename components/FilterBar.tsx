import { CATEGORIES, REGIONS } from "@/lib/query/announcements";

// GET 폼 기반 필터: JS 없이 동작 → WebView에서도 안정적
export default function FilterBar({
  action,
  defaults,
}: {
  action: string;
  defaults: { q?: string; audience?: string; category?: string; region?: string; status?: string; sort?: string };
}) {
  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2">
      {defaults.audience && <input type="hidden" name="audience" value={defaults.audience} />}
      <input
        type="search"
        name="q"
        defaultValue={defaults.q ?? ""}
        placeholder="공고명 검색 (예: 스마트공장)"
        className="h-10 min-w-0 flex-1 basis-52 rounded-md border border-slate-300 bg-white px-3 text-sm"
      />
      <select name="category" defaultValue={defaults.category ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
        <option value="">전체 분야</option>
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <select name="region" defaultValue={defaults.region ?? ""} className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
        <option value="">전체 지역</option>
        {REGIONS.map((r) => (
          <option key={r} value={r}>{r}</option>
        ))}
      </select>
      <select name="status" defaultValue={defaults.status ?? "open"} className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
        <option value="open">모집중</option>
        <option value="closed">마감</option>
        <option value="all">전체</option>
      </select>
      <select name="sort" defaultValue={defaults.sort ?? "deadline"} className="h-10 rounded-md border border-slate-300 bg-white px-2 text-sm">
        <option value="deadline">마감 임박순</option>
        <option value="latest">최신 등록순</option>
      </select>
      <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-primary-dark">
        검색
      </button>
    </form>
  );
}
