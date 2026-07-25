import DetailContentBody from "./DetailContentBody";
import type { AnnouncementDetail } from "@/lib/query/announcements";
import {
  ageConditionLabel,
  announcementRegionLabel,
  policyDomainLabel,
  safeExternalHttpUrl,
} from "@/lib/query/announcement-presentation";

export function YouthCenterPolicyOverview({
  item,
  compact = false,
}: {
  item: AnnouncementDetail;
  compact?: boolean;
}) {
  const rows = [
    ["정책 분야", policyDomainLabel(item.policy_domain)],
    ["신청 상태", sourceStatusLabel(item.source_status)],
    ["신청기간", applicationPeriod(item)],
    ["연령 조건", ageConditionLabel(item.age_min, item.age_max)],
    ["지역 조건", announcementRegionLabel(item.region, item.regions)],
    ["소득 조건", item.income_condition],
    ["학력 조건", item.education_condition],
    ["취업 상태", item.employment_condition],
    ["전공 조건", item.major_condition],
    ["특화 조건", item.specialty_condition],
    ["주관기관", item.organization],
    ["운영기관", item.managing_organization],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  if (rows.length === 0) return null;
  return (
    <dl
      className={`grid grid-cols-1 gap-x-6 rounded-lg border border-line bg-slate-50 ${
        compact ? "mt-4 gap-y-2 p-3 text-xs" : "mt-5 gap-y-3 p-4 text-sm sm:grid-cols-2"
      }`}
    >
      {rows.map(([label, value]) => (
        <div key={label} className="flex min-w-0 gap-3">
          <dt className={`${compact ? "w-16" : "w-24"} shrink-0 font-medium text-subtle`}>
            {label}
          </dt>
          <dd className="min-w-0 break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function YouthCenterPolicyDetails({
  item,
  compact = false,
}: {
  item: AnnouncementDetail;
  compact?: boolean;
}) {
  const applicationUrl = safeExternalHttpUrl(item.application_url);
  const originalUrl =
    safeExternalHttpUrl(item.original_url) ??
    (!applicationUrl ? safeExternalHttpUrl(item.detail_url) : null);
  const hasStoredOriginal = Boolean(
    item.detail_fetched_at && item.detail_content,
  );
  const hasBlocks = Boolean(
    hasStoredOriginal || item.support_content || item.apply_method,
  );

  return (
    <>
      {hasBlocks && (
        <div className={`${compact ? "mt-5 space-y-5" : "mt-6 space-y-7"} border-t border-line pt-5`}>
          {hasStoredOriginal ? (
            <PolicyBlock
              title="상세내용"
              value={item.detail_content}
              compact={compact}
            />
          ) : (
            <>
              <PolicyBlock
                title="지원 내용"
                value={item.support_content}
                compact={compact}
              />
              <PolicyBlock
                title="신청방법"
                value={item.apply_method}
                compact={compact}
              />
            </>
          )}
          {(item.attachments?.length ?? 0) > 0 && (
            <PolicyAttachmentList
              links={item.attachments}
              compact={compact}
            />
          )}
        </div>
      )}

      {(applicationUrl || originalUrl) && (
        <div className={`flex flex-col gap-2 sm:flex-row ${compact ? "mt-4" : "mt-6"}`}>
          {applicationUrl && (
            <ExternalAction href={applicationUrl} primary>
              신청하기
            </ExternalAction>
          )}
          {originalUrl && originalUrl !== applicationUrl && (
            <ExternalAction href={originalUrl}>원문 확인</ExternalAction>
          )}
        </div>
      )}

      <p className={`${compact ? "mt-3 text-[11px]" : "mt-4 text-xs"} leading-relaxed text-slate-400`}>
        신청 가능 여부와 세부 자격은 변경될 수 있으므로 온통청년 또는 해당 기관의 원문에서
        최종 확인해 주세요.
      </p>
    </>
  );
}

function PolicyAttachmentList({
  links,
  compact,
}: {
  links: { label: string; url: string }[];
  compact: boolean;
}) {
  return (
    <section className="border-t border-slate-200 pt-5">
      <h2 className={`font-bold text-ink ${compact ? "text-sm" : "text-base"}`}>
        첨부파일
      </h2>
      <ul className="mt-3 divide-y divide-slate-100 border-y border-slate-100">
        {links.map((link) => (
          <li
            key={`${link.label}-${link.url}`}
            className={`flex gap-3 py-3 ${
              compact
                ? "flex-col text-xs"
                : "flex-col text-sm sm:flex-row sm:items-center sm:justify-between"
            }`}
          >
            <span className="min-w-0 break-words text-slate-700">
              {link.label}
            </span>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-md border border-slate-300 px-4 font-semibold text-ink"
            >
              다운로드
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PolicyBlock({
  title,
  value,
  compact,
}: {
  title: string;
  value: string | null;
  compact: boolean;
}) {
  if (!value) return null;
  return (
    <section className="border-t border-slate-200 pt-5 first:border-t-0 first:pt-0">
      <h2 className={`flex items-center gap-2 font-bold text-ink ${compact ? "text-sm" : "text-base"}`}>
        <span aria-hidden className={`${compact ? "h-4" : "h-[18px]"} w-1 shrink-0 rounded-full bg-primary`} />
        {title}
      </h2>
      <div className={`mt-3 rounded-lg border border-line bg-white ${compact ? "px-4 py-4" : "px-5 py-5"}`}>
        <DetailContentBody text={value} />
      </div>
    </section>
  );
}

function ExternalAction({
  href,
  primary = false,
  children,
}: {
  href: string;
  primary?: boolean;
  children: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-md px-5 text-sm font-semibold ${
        primary
          ? "bg-primary text-white"
          : "border border-primary bg-white text-primary"
      }`}
    >
      {children}
    </a>
  );
}

function sourceStatusLabel(value: AnnouncementDetail["source_status"]) {
  if (value === "open") return "접수중";
  if (value === "upcoming") return "접수예정";
  if (value === "always") return "상시";
  if (value === "closed") return "마감";
  return null;
}

function applicationPeriod(item: AnnouncementDetail) {
  if (!item.apply_start && !item.apply_end) {
    return item.source_status === "always" ? "상시" : null;
  }
  return `${item.apply_start ?? "시작일 미정"} ~ ${item.apply_end ?? "상시/미정"}`;
}
