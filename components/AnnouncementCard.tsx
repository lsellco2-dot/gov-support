import Link from "next/link";
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

function CardApplicationDates({
  applyStart,
  applyEnd,
}: {
  applyStart: string | null;
  applyEnd: string | null;
}) {
  const display = getCardDateDisplay(applyStart, applyEnd);
  return (
    <div className="flex min-w-[112px] shrink-0 flex-col items-end gap-1 text-right">
      {display.receptionLabel && (
        <span className="whitespace-nowrap text-[11px] font-semibold text-primary">
          {display.receptionLabel}
        </span>
      )}
      <span
        className={`shrink-0 whitespace-nowrap rounded-badge px-2 py-0.5 text-xs font-semibold tabular-nums ${
          display.tone === "urgent"
            ? "bg-[#FCE8E6] text-urgent"
            : display.tone === "primary"
              ? "bg-primary-light text-primary"
              : "bg-slate-100 text-subtle"
        }`}
      >
        {display.deadlineLabel}
      </span>
    </div>
  );
}

export function getCardDateDisplay(
  applyStart: string | null,
  applyEnd: string | null,
  today = todayKst(),
) {
  const start = isIsoDate(applyStart) ? applyStart : null;
  const end = isIsoDate(applyEnd) ? applyEnd : null;
  const closed = end !== null && today > end;

  const receptionLabel =
    !start || closed
      ? null
      : today < start
        ? `접수예정 · ${start}`
        : `접수중 · ${start}`;

  if (!end) {
    return { receptionLabel, deadlineLabel: "상시/미정", tone: "neutral" as const };
  }

  const days = dateDifference(end, today);
  if (days < 0) {
    return { receptionLabel: null, deadlineLabel: "마감", tone: "neutral" as const };
  }
  if (days === 0) {
    return { receptionLabel, deadlineLabel: "오늘 마감", tone: "urgent" as const };
  }
  return {
    receptionLabel,
    deadlineLabel: `마감일 - ${days}`,
    tone: days <= 7 ? ("urgent" as const) : ("primary" as const),
  };
}

function isIsoDate(value: string | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function dateDifference(later: string, earlier: string) {
  const laterTime = Date.parse(`${later}T00:00:00Z`);
  const earlierTime = Date.parse(`${earlier}T00:00:00Z`);
  return Math.round((laterTime - earlierTime) / 86_400_000);
}

function todayKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
