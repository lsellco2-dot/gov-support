import AnnouncementCard from "@/components/AnnouncementCard";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import { listAnnouncements } from "@/lib/query/announcements";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function HomePage({ searchParams }: { searchParams: SP }) {
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
      <FilterBar action="/" defaults={searchParams} />
      <p className="mt-4 text-sm text-slate-500">
        총 <b className="text-ink tabular-nums">{total.toLocaleString()}</b>건
      </p>
      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
          조건에 맞는 공고가 없습니다. 검색어나 필터를 바꿔 보세요.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <AnnouncementCard key={item.id} item={item} basePath="" />
          ))}
        </div>
      )}
      <Pagination page={page} size={size} total={total} basePath="/" params={searchParams} />
    </div>
  );
}
