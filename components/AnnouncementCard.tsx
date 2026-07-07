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
      className="block rounded-lg border border-slate-200 bg-white p-4 transition hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-[15px] font-semibold leading-snug text-ink line-clamp-2">
          {item.title}
        </h3>
        <DDayBadge applyEnd={item.apply_end} />
      </div>
      <p className="mt-1.5 text-[13px] text-slate-500">
        {item.organization ?? "기관 미상"} · {item.region ?? "전국"}
        {item.apply_end ? ` · ~${item.apply_end}` : ""}
      </p>
      <div className="mt-2">
        <CategoryChips ids={item.category_ids} />
      </div>
    </Link>
  );
}
