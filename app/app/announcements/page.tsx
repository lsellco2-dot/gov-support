import Link from "next/link";
import { redirect } from "next/navigation";
import AnnouncementCard from "@/components/AnnouncementCard";
import AudienceEntryCards from "@/components/AudienceEntryCards";
import FilterBar from "@/components/FilterBar";
import Pagination from "@/components/Pagination";
import { listAnnouncements, normalizeAudience } from "@/lib/query/announcements";
import { normalizeAge } from "@/lib/query/age";
import { canonicalPageUrl } from "@/lib/query/pagination";
import { nativeBannerAttributes } from "@/lib/mobile/native-banner";

export const dynamic = "force-dynamic";

type SP = Record<string, string | undefined>;

export default async function AppAnnouncementsPage({ searchParams }: { searchParams: SP }) {
  const audience = normalizeAudience(searchParams.audience);
  const { items, total, page, size } = await listAnnouncements({
    q: searchParams.q,
    topic: searchParams.topic,
    age: normalizeAge(searchParams.age),
    ageKnownOnly: searchParams.ageKnownOnly === "1",
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
        {searchParams.status === "all" ? "전체" : searchParams.status === "closed" ? "마감" : "모집중"}{" "}
        <b className="text-ink tabular-nums">{total.toLocaleString()}</b>건 · {searchParams.sort === "deadline" ? "마감 임박순" : "최신 등록순"}
      </p>
      <div className="mt-2 space-y-2.5" {...nativeBannerAttributes("/app/announcements", "ready", items.length)}>
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
