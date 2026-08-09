import {
  INDUSTRY_OPTIONS,
  INTEREST_OPTIONS,
  REGION_OPTIONS,
  STARTUP_YEAR_OPTIONS,
  USER_CONDITION_SCHEMA_VERSION,
  USER_TYPE_OPTIONS,
  type UserCondition,
} from "@/lib/mobile/user-condition";
import {
  POLICY_DOMAIN_OPTIONS,
  type PolicyDomain,
} from "@/lib/query/announcement-presentation";

export const AI_LAB_CANDIDATE_LIMITS = [10, 20, 30, 50] as const;
export const AI_LAB_SORTS = ["score", "deadline"] as const;

export type AiLabCandidateLimit = (typeof AI_LAB_CANDIDATE_LIMITS)[number];
export type AiLabSort = (typeof AI_LAB_SORTS)[number];

export interface AiLabProfile extends UserCondition {
  birth_year: number | null;
  employment_status: string;
  youth_policy_interests: PolicyDomain[];
  business_item_description: string;
  needed_support: string;
}

export interface AiLabSearchInput {
  profile: AiLabProfile;
  include_nationwide: boolean;
  candidate_limit: AiLabCandidateLimit;
  sort: AiLabSort;
}

export interface AiLabCandidate {
  id: number;
  title: string;
  source: string;
  source_name: string;
  agency: string | null;
  region: string | null;
  regions: string[] | null;
  apply_start: string | null;
  apply_end: string | null;
  status: "open" | "upcoming";
  score: number;
  reasons: string[];
  category_ids: number[];
  category_names: string[];
  policy_domain: PolicyDomain | null;
  policy_domain_label: string | null;
  detail_url: string;
  original_url: string | null;
}

export interface AiLabSearchResponse {
  input: AiLabSearchInput;
  metrics: {
    total_public: number;
    rule_candidates: number;
    final_candidates: number;
    db_ms: number;
    recommendation_ms: number;
    total_ms: number;
  };
  candidates: AiLabCandidate[];
}

type ParseResult =
  | { ok: true; value: AiLabSearchInput }
  | { ok: false; error: string };

const USER_TYPES = optionValues(USER_TYPE_OPTIONS);
const REGIONS = optionValues(REGION_OPTIONS);
const INDUSTRIES = optionValues(INDUSTRY_OPTIONS);
const INTERESTS = optionValues(INTEREST_OPTIONS);
const STARTUP_YEARS = optionValues(STARTUP_YEAR_OPTIONS);
const POLICY_DOMAINS = optionValues(POLICY_DOMAIN_OPTIONS);

export function parseAiLabSearchInput(value: unknown): ParseResult {
  if (!isRecord(value) || !isRecord(value.profile)) {
    return invalid("검색 조건 형식이 올바르지 않습니다.");
  }
  const profile = value.profile;
  const userType = option(profile.user_type, USER_TYPES);
  const region = option(profile.region, REGIONS);
  const industry = option(profile.industry, INDUSTRIES);
  const startupYears = option(profile.startup_years, STARTUP_YEARS);
  const interests = optionArray(profile.interests, INTERESTS);
  const youthInterests = optionArray(
    profile.youth_policy_interests ?? [],
    POLICY_DOMAINS,
  ) as PolicyDomain[] | null;
  const candidateLimit = Number(value.candidate_limit);
  const sort = typeof value.sort === "string" ? value.sort : "";

  if (!userType || !region || !industry || !startupYears || !interests?.length) {
    return invalid("사용자 유형, 지역, 업종, 창업 연차와 관심 분야를 확인해 주세요.");
  }
  if (!youthInterests) return invalid("청년정책 관심 분야가 올바르지 않습니다.");
  if (!AI_LAB_CANDIDATE_LIMITS.includes(candidateLimit as AiLabCandidateLimit)) {
    return invalid("후보 개수는 10, 20, 30, 50 중 하나여야 합니다.");
  }
  if (!AI_LAB_SORTS.includes(sort as AiLabSort)) {
    return invalid("정렬 방식이 올바르지 않습니다.");
  }
  if (typeof value.include_nationwide !== "boolean") {
    return invalid("전국 공고 포함 여부가 올바르지 않습니다.");
  }

  const birthYear = optionalBirthYear(profile.birth_year);
  if (birthYear === undefined) return invalid("출생연도를 확인해 주세요.");
  const employmentStatus = optionalText(profile.employment_status, 100);
  const businessDescription = optionalText(
    profile.business_item_description,
    2_000,
  );
  const neededSupport = optionalText(profile.needed_support, 1_000);
  if (
    employmentStatus === null ||
    businessDescription === null ||
    neededSupport === null
  ) {
    return invalid("자유입력 항목의 길이를 확인해 주세요.");
  }

  return {
    ok: true,
    value: {
      profile: {
        user_type: userType,
        region,
        industry,
        interests,
        startup_years:
          userType === "job_seeker_worker" ? "not_applicable" : startupYears,
        onboarding_completed: true,
        schema_version: USER_CONDITION_SCHEMA_VERSION,
        birth_year: birthYear,
        employment_status: employmentStatus,
        youth_policy_interests: youthInterests,
        business_item_description: businessDescription,
        needed_support: neededSupport,
      },
      include_nationwide: value.include_nationwide,
      candidate_limit: candidateLimit as AiLabCandidateLimit,
      sort: sort as AiLabSort,
    },
  };
}

export function sortAiLabCandidates(
  candidates: AiLabCandidate[],
  sort: AiLabSort,
) {
  return [...candidates].sort((left, right) => {
    if (sort === "deadline") {
      return (
        compareDeadline(left.apply_end, right.apply_end) ||
        right.score - left.score ||
        right.id - left.id
      );
    }
    return (
      right.score - left.score ||
      compareDeadline(left.apply_end, right.apply_end) ||
      right.id - left.id
    );
  });
}

function compareDeadline(left: string | null, right: string | null) {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

function optionalBirthYear(value: unknown): number | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  const year = Number(value);
  const currentYear = new Date().getUTCFullYear();
  return Number.isInteger(year) && year >= 1900 && year <= currentYear
    ? year
    : undefined;
}

function optionalText(value: unknown, maxLength: number) {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length <= maxLength ? text : null;
}

function option(value: unknown, allowed: Set<string>) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return allowed.has(normalized) ? normalized : null;
}

function optionArray(value: unknown, allowed: Set<string>) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }
  const normalized = [...new Set(value.map((item) => item.trim()).filter(Boolean))];
  return normalized.every((item) => allowed.has(item)) ? normalized : null;
}

function optionValues(options: readonly { value: string }[]) {
  return new Set(options.map(({ value }) => value));
}

function invalid(error: string): ParseResult {
  return { ok: false, error };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
