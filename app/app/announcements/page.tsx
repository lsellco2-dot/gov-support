import Link from "next/link";
import AnnouncementCard from "@/components/AnnouncementCard";
import AudienceEntryCards from "@/components/AudienceEntryCards";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import { listAnnouncements, type AudienceGroup } from "@/lib/query/announcements";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function AppAnnouncementsPage({ searchParams }: { searchParams: SP }) {
  const audience = normalizeAudience(searchParams.audience);
  const { items, total, page, size } = await listAnnouncements({
    q: searchParams.q,
    audience,
    category: searchParams.category ? Number(searchParams.category) : undefined,
    region: searchParams.region,
    status: (searchParams.status as any) ?? "open",
    sort: (searchParams.sort as any) ?? "deadline",
    page: searchParams.page ? Number(searchParams.page) : 1,
  });

  return (
    <div>
      <Link href="/app" className="text-sm text-slate-500">
        ← 처음으로
      </Link>

      <section className="mt-2">
        <AudienceEntryCards basePath="/app/announcements" active={audience} params={searchParams} variant="compact" />
      </section>

      <div className="mt-3">
        <FilterBar action="/app/announcements" defaults={searchParams} />
      </div>

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
      <Pagination page={page} size={size} total={total} basePath="/app/announcements" params={searchParams} />
    </div>
  );
}

function normalizeAudience(value: string | undefined): AudienceGroup {
  return value === "business" || value === "worker" || value === "all" ? value : "all";
}
