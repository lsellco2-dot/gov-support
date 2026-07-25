import { announcementSourceLabel } from "@/lib/mobile/announcement-source";
import {
  ageConditionLabel,
  announcementRegionLabel,
  isYouthCenterSource,
  policyDomainLabel,
} from "@/lib/query/announcement-presentation";

export function AnnouncementSourceBadge({
  sourceCode,
  sourceName,
}: {
  sourceCode?: string | null;
  sourceName?: string | null;
}) {
  if (!sourceCode && !sourceName) return null;
  return (
    <span className="inline-flex max-w-full rounded-badge bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
      <span className="truncate">
        출처: {announcementSourceLabel(sourceCode, sourceName)}
      </span>
    </span>
  );
}

export function YouthPolicyChips({
  sourceCode,
  policyDomain,
  ageMin,
  ageMax,
}: {
  sourceCode?: string | null;
  policyDomain?: string | null;
  ageMin?: number | null;
  ageMax?: number | null;
}) {
  if (!isYouthCenterSource(sourceCode)) return null;
  const domain = policyDomainLabel(policyDomain);
  const age = ageConditionLabel(ageMin, ageMax);
  if (!domain && !age) return null;
  return (
    <div className="mt-2 flex min-w-0 flex-wrap gap-1.5">
      {domain && <MetaChip>{domain}</MetaChip>}
      {age && <MetaChip>{age}</MetaChip>}
    </div>
  );
}

export function YouthPolicyRegion({
  sourceCode,
  region,
  regions,
}: {
  sourceCode?: string | null;
  region?: string | null;
  regions?: string[] | null;
}) {
  if (!isYouthCenterSource(sourceCode)) return null;
  return <>{announcementRegionLabel(region, regions)}</>;
}

function MetaChip({ children }: { children: string }) {
  return (
    <span className="max-w-full break-words rounded-badge bg-primary-light px-2 py-1 text-[11px] font-semibold text-primary-dark">
      {children}
    </span>
  );
}
