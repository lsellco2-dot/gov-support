import type { NativeUserCondition } from "./app-bridge";

export const INTEREST_CATEGORY_IDS: Record<string, number> = {
  startup_support: 1,
  small_business_support: 2,
  finance_loan_guarantee: 3,
  marketing_sales: 4,
  employment_labor_cost: 5,
  technology_rnd: 6,
  export_global: 7,
  education_consulting: 8,
  facility_digital: 9,
};

export interface OpenAnnouncement {
  id: number;
  source?: string | null;
  title: string;
  agency: string | null;
  category_ids: number[];
  region: string | null;
  target: string | null;
  support_type: string | null;
  status: "open";
  apply_start: string | null;
  apply_end: string | null;
  created_at: string;
  detail_url: string;
  original_url: string | null;
}

export interface RecommendationResult {
  announcement: OpenAnnouncement;
  matchedCategoryIds: number[];
  reasons: string[];
  needsAdditionalReview: boolean;
}

type FieldMatch = "match" | "conflict" | "unknown";

export function evaluateRecommendation(
  condition: NativeUserCondition,
  announcement: OpenAnnouncement,
): RecommendationResult | null {
  if (announcement.status !== "open" || !condition.onboarding_completed) return null;

  const interestedIds = new Set(
    condition.interests
      .map((code) => INTEREST_CATEGORY_IDS[code])
      .filter((id): id is number => typeof id === "number"),
  );
  const matchedCategoryIds = announcement.category_ids
    .filter((id) => interestedIds.has(id))
    .filter((id, index, values) => values.indexOf(id) === index)
    .sort((a, b) => a - b);
  if (matchedCategoryIds.length === 0) return null;

  const region = matchRegion(condition.region, announcement.region);
  if (region === "conflict") return null;
  const target = matchTarget(condition.user_type, announcement.target);
  if (target === "conflict") return null;

  const reasons = ["관심 분야 일치"];
  reasons.push(region === "match" ? "지역 일치" : "지역 확인 필요");
  if (target === "unknown") reasons.push("지원대상 확인 필요");

  return {
    announcement,
    matchedCategoryIds,
    reasons,
    needsAdditionalReview: region === "unknown" || target === "unknown",
  };
}

export function matchRecommendations(
  condition: NativeUserCondition,
  announcements: OpenAnnouncement[],
): RecommendationResult[] {
  return announcements.flatMap((announcement) => {
    const result = evaluateRecommendation(condition, announcement);
    return result ? [result] : [];
  });
}

export function filterNationwideRecommendations(
  recommendations: RecommendationResult[],
  userRegion: string,
  includeNationwide: boolean,
) {
  if (includeNationwide || isNationwideUserRegion(userRegion)) return recommendations;
  return recommendations.filter(
    ({ announcement }) => !isNationwideRegion(announcement.region),
  );
}

export function isNationwideUserRegion(region: string) {
  const value = region.trim().toLowerCase();
  return value === "nationwide" || value === "전국";
}

function isNationwideRegion(region: string | null) {
  if (!region?.trim()) return false;
  const value = region.trim().toLowerCase();
  return value === "nationwide" || value.includes("전국");
}

function matchRegion(userRegion: string, announcementRegion: string | null): FieldMatch {
  if (userRegion === "nationwide") return "match";
  if (!announcementRegion?.trim()) return "unknown";
  const value = announcementRegion.trim().toLowerCase();
  if (value === "nationwide" || value.includes("전국")) return "match";
  const expected = REGION_LABELS[userRegion];
  if (!expected) return "unknown";
  return value === userRegion || value.includes(expected) ? "match" : "conflict";
}

function matchTarget(userType: string, announcementTarget: string | null): FieldMatch {
  if (!announcementTarget?.trim()) return "unknown";
  const value = announcementTarget.toLowerCase();
  const mentionsBusiness = BUSINESS_TARGET_KEYWORDS.some((keyword) => value.includes(keyword));
  const mentionsWorker = WORKER_TARGET_KEYWORDS.some((keyword) => value.includes(keyword));
  if (mentionsBusiness && mentionsWorker) return "match";

  if (userType === "job_seeker_worker") return mentionsBusiness ? "conflict" : "match";
  if (["pre_startup", "sole_proprietor", "small_business", "sme"].includes(userType)) {
    return mentionsWorker ? "conflict" : "match";
  }
  if (userType === "other") return "match";
  return "unknown";
}

const REGION_LABELS: Record<string, string> = {
  seoul: "서울",
  busan: "부산",
  daegu: "대구",
  incheon: "인천",
  gwangju: "광주",
  daejeon: "대전",
  ulsan: "울산",
  sejong: "세종",
  gyeonggi: "경기",
  gangwon: "강원",
  chungbuk: "충북",
  chungnam: "충남",
  jeonbuk: "전북",
  jeonnam: "전남",
  gyeongbuk: "경북",
  gyeongnam: "경남",
  jeju: "제주",
};

const BUSINESS_TARGET_KEYWORDS = [
  "사업자",
  "소상공인",
  "중소기업",
  "법인",
  "창업기업",
  "자영업",
];

const WORKER_TARGET_KEYWORDS = [
  "구직자",
  "취업준비생",
  "직장인",
  "근로자",
  "재직자",
  "채용",
];
