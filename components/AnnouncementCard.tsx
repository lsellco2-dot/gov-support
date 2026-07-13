import Link from "next/link";
import CardApplicationDates from "./CardApplicationDates";
import CategoryChips from "./CategoryChips";
import FavoriteButton from "./FavoriteButton";
import type { AnnouncementRow } from "@/lib/query/announcements";

export default function AnnouncementCard({
  item,
  basePath,
  showFavorite = false,
}: {
  item: AnnouncementRow;
  basePath: string; // '' (PC) 또는 '/app'
  showFavorite?: boolean;
}) {
  return (
    <article className="flex h-full min-w-0 flex-col rounded-lg border border-line bg-white p-5 transition hover:border-primary hover:shadow-[0_2px_12px_rgba(37,110,244,0.1)]">
      <Link href={`${basePath}/announcements/${item.id}`} className="min-w-0">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words text-[15px] font-bold leading-snug text-ink line-clamp-2">
            {item.title}
          </h3>
          <CardApplicationDates
            applyStart={item.apply_start}
            applyEnd={item.apply_end}
          />
        </div>
        <p className="mt-2 break-words text-[13px] text-subtle">
          {item.organization ?? "기관 미상"} · {item.region ?? "전국"}
        </p>
        <div className="mt-3">
          <CategoryChips ids={item.category_ids} />
        </div>
      </Link>
      {showFavorite && (
        <FavoriteButton
          compact
          announcement={{
            id: item.id,
            title: item.title,
            agency: item.organization,
            category_ids: item.category_ids,
            region: item.region,
            status: item.status,
            apply_end: item.apply_end,
            detail_url: `/app/announcements/${item.id}`,
            original_url: item.detail_url,
          }}
        />
      )}
    </article>
  );
}
