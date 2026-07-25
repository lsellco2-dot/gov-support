import { sanitizeDisplayText } from "@/lib/text/sanitize";
import { buildYouthCenterPolicyDetailUrl } from "@/lib/youthcenter/url";

export type PolicyDomain =
  | "employment_startup"
  | "housing"
  | "education_training"
  | "finance_welfare_culture"
  | "participation_infrastructure";

export type AnnouncementSourceStatus =
  | "open"
  | "upcoming"
  | "always"
  | "closed"
  | "unknown";

export interface AnnouncementPresentationFields {
  source_code?: string | null;
  source_name?: string | null;
  regions?: string[] | null;
  age_min?: number | null;
  age_max?: number | null;
  policy_domain?: PolicyDomain | null;
  source_status?: AnnouncementSourceStatus | null;
}

export interface YouthCenterDetailFields {
  managing_organization: string | null;
  income_condition: string | null;
  education_condition: string | null;
  employment_condition: string | null;
  major_condition: string | null;
  specialty_condition: string | null;
  application_url: string | null;
  original_url: string | null;
}

const POLICY_DOMAIN_LABELS: Record<PolicyDomain, string> = {
  employment_startup: "취업·창업",
  housing: "주거",
  education_training: "교육·직업훈련",
  finance_welfare_culture: "금융·복지·문화",
  participation_infrastructure: "참여·기반",
};

export function policyDomainLabel(value: string | null | undefined) {
  return value && value in POLICY_DOMAIN_LABELS
    ? POLICY_DOMAIN_LABELS[value as PolicyDomain]
    : null;
}

export function announcementRegionLabel(
  region: string | null | undefined,
  regions: string[] | null | undefined,
) {
  const values = uniqueDisplayStrings(regions);
  if (values.length === 0) {
    const fallback = sanitizeDisplayText(region)?.trim();
    return fallback || "지역 확인 필요";
  }
  if (values.length <= 2) return values.join(", ");
  return `${values.slice(0, 2).join(", ")} 외 ${values.length - 2}개`;
}

export function ageConditionLabel(
  ageMin: number | null | undefined,
  ageMax: number | null | undefined,
) {
  const min = validAge(ageMin);
  const max = validAge(ageMax);
  if (min !== null && max !== null) {
    if (min > max) return null;
    return min === max ? `만 ${min}세` : `만 ${min}~${max}세`;
  }
  if (min !== null) return `만 ${min}세 이상`;
  if (max !== null) return `만 ${max}세 이하`;
  return null;
}

export function isYouthCenterSource(sourceCode: string | null | undefined) {
  return sourceCode === "youthcenter";
}

export function safeExternalHttpUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = /^www\./i.test(value.trim())
    ? `https://${value.trim()}`
    : value.trim();
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function normalizePresentationFields(
  row: Record<string, unknown>,
  source?: { code?: unknown; name?: unknown } | null,
): AnnouncementPresentationFields {
  return {
    source_code: displayString(source?.code),
    source_name: displayString(source?.name),
    regions: nullableDisplayStrings(row.regions),
    age_min: validAge(row.age_min),
    age_max: validAge(row.age_max),
    policy_domain: normalizePolicyDomain(row.policy_domain),
    source_status: normalizeSourceStatus(row.source_status),
  };
}

export function youthCenterDetailFields(
  rawJson: unknown,
  sourceKey?: string | null,
): YouthCenterDetailFields {
  const wrapper = record(rawJson);
  const normalized = record(wrapper?.normalized);
  return {
    managing_organization: displayString(normalized?.managingOrganization),
    income_condition: displayString(normalized?.incomeCondition),
    education_condition: displayString(normalized?.educationCondition),
    employment_condition: displayString(normalized?.employmentCondition),
    major_condition: displayString(normalized?.majorCondition),
    specialty_condition: displayString(normalized?.specialtyCondition),
    application_url: safeExternalHttpUrl(normalized?.applicationUrl),
    original_url:
      buildYouthCenterPolicyDetailUrl(sourceKey) ??
      safeExternalHttpUrl(normalized?.originalUrl),
  };
}

export function detailSection(text: string | null | undefined, title: string) {
  if (!text) return null;
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(
    new RegExp(`(?:^|\\n)\\[${escaped}\\]\\s*\\n([\\s\\S]*?)(?=\\n\\n\\[[^\\]]+\\]\\s*\\n|$)`),
  );
  return sanitizeDisplayText(match?.[1]?.trim() || null);
}

function normalizePolicyDomain(value: unknown): PolicyDomain | null {
  return typeof value === "string" && value in POLICY_DOMAIN_LABELS
    ? (value as PolicyDomain)
    : null;
}

function normalizeSourceStatus(value: unknown): AnnouncementSourceStatus | null {
  return value === "open" ||
    value === "upcoming" ||
    value === "always" ||
    value === "closed" ||
    value === "unknown"
    ? value
    : null;
}

function validAge(value: unknown) {
  const age = typeof value === "number" ? value : Number(value);
  return Number.isInteger(age) && age >= 1 && age <= 120 ? age : null;
}

function displayString(value: unknown) {
  return typeof value === "string"
    ? sanitizeDisplayText(value)?.trim() || null
    : null;
}

function nullableDisplayStrings(value: unknown) {
  const values = uniqueDisplayStrings(value);
  return values.length > 0 ? values : null;
}

function uniqueDisplayStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(displayString)
        .filter((item): item is string => Boolean(item)),
    ),
  ];
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
