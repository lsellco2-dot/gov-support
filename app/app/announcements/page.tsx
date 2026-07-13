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

export default async function AppAnnouncementsPage({ searchParams }: { searchParams: SP }) {
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
  const canonicalUrl = canonicalPageUrl("/app/announcements", searchParams, page, total, size);
  if (canonicalUrl) redirect(canonicalUrl);

  return (
    <div>
      <Link href="/app" className="text-sm text-subtle">
        ← 처음으로
      </Link>

      <section className="mt-2">
        <AudienceEntryCards basePath="/app/announcements" active={audience} params={searchParams} variant="compact" />
      </section>

      <div className="mt-3">
        <FilterBar action="/app/announcements" defaults={searchParams} />
      </div>

      <p className="mt-3 text-xs text-subtle">
        모집중 <b className="text-ink tabular-nums">{total.toLocaleString()}</b>건 · 최신 등록순
      </p>
      <div className="mt-2 space-y-2.5">
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line bg-white p-8 text-center text-sm text-subtle">
            조건에 맞는 공고가 없습니다.
          </div>
        ) : (
          items.map((item) => (
            <AnnouncementCard key={item.id} item={item} basePath="/app" showFavorite />
          ))
        )}
      </div>
      <Pagination page={page} size={size} total={total} basePath="/app/announcements" params={searchParams} />
    </div>
  );
}

function normalizeAudience(value: string | undefined): AudienceGroup {
  return value === "business" || value === "worker" || value === "all" ? value : "all";
}
