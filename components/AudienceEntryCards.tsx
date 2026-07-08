import Link from "next/link";
import type { AudienceGroup } from "@/lib/query/announcements";

const AUDIENCE_CARDS: Array<{
  id: AudienceGroup;
  title: string;
  description: string;
  buttonLabel: string;
  icon: string;
}> = [
  {
    id: "all",
    title: "전체 공고",
    description: "분류와 상관없이 모든 모집 공고를 확인합니다.",
    buttonLabel: "전체 공고 보기",
    icon: "📋",
  },
  {
    id: "business",
    title: "창업자·사업자·소상공인",
    description: "창업, 사업자, 중소기업, 소상공인 대상 지원사업을 모았습니다.",
    buttonLabel: "사업자 공고 보기",
    icon: "🏢",
  },
  {
    id: "worker",
    title: "취업준비생·직장인",
    description: "취업, 청년, 재직자, 근로자, 직무교육 공고를 모았습니다.",
    buttonLabel: "취업·직장인 공고 보기",
    icon: "🎓",
  },
];

export default function AudienceEntryCards({
  basePath,
  active,
  params,
  variant = "tabs",
}: {
  basePath: string;
  active: AudienceGroup;
  params: Record<string, string | undefined>;
  /** "landing" = 히어로용 큰 카드(아이콘+버튼), "tabs" = 목록 상단 전환 탭, "compact" = 모바일 목록 탭 */
  variant?: "landing" | "tabs" | "compact";
}) {
  if (variant === "landing") {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {AUDIENCE_CARDS.map((card) => (
          <Link
            key={card.id}
            href={hrefFor(basePath, params, card.id)}
            className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-2xl">
              {card.icon}
            </span>
            <h3 className="mt-4 text-lg font-bold text-ink">{card.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
              {card.description}
            </p>
            <span className="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white transition group-hover:bg-primary-dark">
              {card.buttonLabel}
            </span>
          </Link>
        ))}
      </div>
    );
  }

  const compact = variant === "compact";
  return (
    <div className={compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-3 md:grid-cols-3"}>
      {AUDIENCE_CARDS.map((card) => {
        const selected = active === card.id || (!active && card.id === "all");
        return (
          <Link
            key={card.id}
            href={hrefFor(basePath, params, card.id)}
            className={[
              "block rounded-lg border bg-white transition hover:border-primary/50 hover:shadow-sm",
              compact ? "p-3" : "p-5",
              selected ? "border-primary ring-2 ring-primary/10" : "border-slate-200",
            ].join(" ")}
          >
            <span className={compact ? "text-sm font-bold text-ink" : "text-base font-bold text-ink"}>
              {card.icon} {card.title}
            </span>
            <p className={compact ? "mt-1 text-xs leading-relaxed text-slate-500" : "mt-2 text-sm leading-relaxed text-slate-500"}>
              {card.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

function hrefFor(
  basePath: string,
  params: Record<string, string | undefined>,
  audience: AudienceGroup
) {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.region) sp.set("region", params.region);
  if (params.category) sp.set("category", params.category);
  sp.set("status", params.status ?? "open");
  sp.set("sort", params.sort ?? "deadline");
  sp.set("audience", audience);
  return `${basePath}?${sp.toString()}`;
}
