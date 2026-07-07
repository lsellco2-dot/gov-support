// 이 서비스의 시그니처: 모든 공고 카드의 우측에 붙는 마감 배지
export default function DDayBadge({ applyEnd }: { applyEnd: string | null }) {
  if (!applyEnd) {
    return (
      <span className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-500">
        상시
      </span>
    );
  }
  const end = new Date(applyEnd + "T23:59:59+09:00");
  const days = Math.ceil((end.getTime() - Date.now()) / 86400000);

  if (days < 0) {
    return (
      <span className="shrink-0 rounded px-2 py-0.5 text-xs font-semibold bg-slate-200 text-slate-400">
        마감
      </span>
    );
  }
  const urgent = days <= 7;
  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 text-xs font-bold tabular-nums ${
        urgent ? "bg-red-50 text-urgent" : "bg-primary-light text-primary"
      }`}
    >
      {days === 0 ? "오늘 마감" : `D-${days}`}
    </span>
  );
}
