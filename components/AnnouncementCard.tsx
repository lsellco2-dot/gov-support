import Link from "next/link";
import CardApplicationDates from "./CardApplicationDates";
import CategoryChips from "./CategoryChips";
import FavoriteButton from "./FavoriteButton";
import {
  AnnouncementSourceBadge,
  YouthPolicyChips,
  YouthPolicyRegion,
} from "./AnnouncementPolicyMeta";
import type { AnnouncementRow } from "@/lib/query/announcements";
import { isYouthCenterSource } from "@/lib/query/announcement-presentation";

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
        {isYouthCenterSource(item.source_code) && (
          <div className="mb-2">
            <AnnouncementSourceBadge
              sourceCode={item.source_code}
              sourceName={item.source_name}
            />
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 break-words text-[15px] font-bold leading-snug text-ink line-clamp-2">
            {item.title}
          </h3>
          <CardApplicationDates
            applyStart={item.apply_start}
            applyEnd={item.apply_end}
            status={isYouthCenterSource(item.source_code) ? item.status : undefined}
            sourceStatus={
              isYouthCenterSource(item.source_code)
                ? item.source_status
                : undefined
            }
          />
        </div>
        <p className="mt-2 break-words text-[13px] text-subtle">
          {item.organization ?? "기관 미상"} ·{" "}
          <YouthPolicyRegion
            sourceCode={item.source_code}
            region={item.region}
            regions={item.regions}
          />
          {!isYouthCenterSource(item.source_code) && (item.region ?? "전국")}
        </p>
        <YouthPolicyChips
          sourceCode={item.source_code}
          policyDomain={item.policy_domain}
          ageMin={item.age_min}
          ageMax={item.age_max}
        />
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
