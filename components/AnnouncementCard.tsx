import Link from "next/link";
import DDayBadge from "./DDayBadge";
import CategoryChips from "./CategoryChips";
import type { AnnouncementRow } from "@/lib/query/announcements";

export default function AnnouncementCard({
  item,
  basePath,
}: {
  item: AnnouncementRow;
  basePath: string; // '' (PC) 또는 '/app'
}) {
  return (
    <Link
      href={`${basePath}/announcements/${item.id}`}
      className="flex h-full flex-col rounded-lg border border-line bg-white p-5 transition hover:border-primary hover:shadow-[0_2px_12px_rgba(37,110,244,0.1)]"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-bold leading-snug text-ink line-clamp-2">
          {item.title}
        </h3>
        <DDayBadge applyEnd={item.apply_end} />
      </div>
      <p className="mt-2 text-[13px] text-subtle">
        {item.organization ?? "기관 미상"} · {item.region ?? "전국"}
        {item.apply_end ? ` · ~${item.apply_end}` : ""}
      </p>
      <div className="mt-3">
        <CategoryChips ids={item.category_ids} />
      </div>
    </Link>
  );
}
