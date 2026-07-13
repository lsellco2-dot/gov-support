import Link from "next/link";
import { redirect } from "next/navigation";
import AnnouncementCard from "@/components/AnnouncementCard";
import AudienceEntryCards from "@/components/AudienceEntryCards";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import { listAnnouncements, type AudienceGroup } from "@/lib/query/announcements";
import { canonicalPageUrl } from "@/lib/query/pagination";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function AnnouncementsPage({ searchParams }: { searchParams: SP }) {
  const audience = normalizeAudience(searchParams.audience);
  const { items, total, page, size } = await listAnnouncements({
    q: searchParams.q,
    audience,
    category: searchParams.category ? Number(searchParams.category) : undefined,
    region: searchParams.region,
    status: (searchParams.status as any) ?? "open",
    sort: (searchParams.sort as any) ?? "latest",
    page: searchParams.page ? Number(searchParams.page) : 1,
  });
  const canonicalUrl = canonicalPageUrl("/announcements", searchParams, page, total, size);
  if (canonicalUrl) redirect(canonicalUrl);

  return (
    <div>
      <Link href="/" className="text-sm text-subtle hover:text-primary">
        ← 처음으로
      </Link>

      <section className="mt-3">
        <AudienceEntryCards basePath="/announcements" active={audience} params={searchParams} />
      </section>

      <div className="mt-4">
        <FilterBar action="/announcements" defaults={searchParams} />
      </div>

      <p className="mt-5 text-sm text-subtle">
        총 <b className="text-ink tabular-nums">{total.toLocaleString()}</b>건
      </p>
      {items.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-line bg-white p-10 text-center text-sm text-subtle">
          조건에 맞는 공고가 없습니다. 검색어나 필터를 바꿔 보세요.
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {items.map((item) => (
            <AnnouncementCard key={item.id} item={item} basePath="" />
          ))}
        </div>
      )}
      <Pagination page={page} size={size} total={total} basePath="/announcements" params={searchParams} />
    </div>
  );
}

function normalizeAudience(value: string | undefined): AudienceGroup {
  return value === "business" || value === "worker" || value === "all" ? value : "all";
}
