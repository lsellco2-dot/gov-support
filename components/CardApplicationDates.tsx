export default function CardApplicationDates({
  applyStart,
  applyEnd,
  status,
}: {
  applyStart: string | null;
  applyEnd: string | null;
  status?: "open" | "closed" | null;
}) {
  const display = getCardDateDisplay(applyStart, applyEnd);
  const receptionLabel =
    status === "open" ? "접수중" : status === "closed" ? null : display.receptionLabel;
  return (
    <div className="flex min-w-[112px] shrink-0 flex-col items-end gap-1 text-right">
      {receptionLabel && (
        <span className="whitespace-nowrap text-[11px] font-semibold text-primary">
          {receptionLabel}
        </span>
      )}
      <span
        className={`shrink-0 whitespace-nowrap rounded-badge px-2 py-0.5 text-xs font-semibold tabular-nums ${
          display.tone === "urgent"
            ? "bg-[#FCE8E6] text-urgent"
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
        ? `접수일 · ${start}`
        : "접수중";

  if (!end) {
    return { receptionLabel, deadlineLabel: "상시/미정", tone: "neutral" as const };
  }

  const days = dateDifference(end, today);
  if (days < 0) {
    return { receptionLabel: null, deadlineLabel: "마감", tone: "urgent" as const };
  }
  if (days === 0) {
    return { receptionLabel, deadlineLabel: "오늘 마감", tone: "urgent" as const };
  }
  return {
    receptionLabel,
    deadlineLabel: `마감일 - ${days}`,
    tone: "urgent" as const,
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
