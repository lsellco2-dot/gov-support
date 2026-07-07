import AnnouncementCard from "@/components/AnnouncementCard";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import { listAnnouncements } from "@/lib/query/announcements";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function AppHome({ searchParams }: { searchParams: SP }) {
  const { items, total, page, size } = await listAnnouncements({
    q: searchParams.q,
    category: searchParams.category ? Number(searchParams.category) : undefined,
    region: searchParams.region,
    status: (searchParams.status as any) ?? "open",
    sort: (searchParams.sort as any) ?? "deadline",
    page: searchParams.page ? Number(searchParams.page) : 1,
  });

  return (
    <div>
      <FilterBar action="/app" defaults={searchParams} />
      <p className="mt-3 text-xs text-slate-500">
        모집중 <b className="tabular-nums">{total.toLocaleString()}</b>건 · 마감 임박순
      </p>
      <div className="mt-2 space-y-2.5">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            조건에 맞는 공고가 없습니다.
          </div>
        ) : (
          items.map((item) => <AnnouncementCard key={item.id} item={item} basePath="/app" />)
        )}
      </div>
      <Pagination page={page} size={size} total={total} basePath="/app" params={searchParams} />
    </div>
  );
}
