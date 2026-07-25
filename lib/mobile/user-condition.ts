export const USER_CONDITION_SCHEMA_VERSION = 1 as const;
export const WEB_USER_CONDITION_STORAGE_KEY = "govsupport:web-user-condition" as const;
export const USER_CONDITION_CHANGED_EVENT =
  "govsupport:user-condition-changed" as const;

export interface UserCondition {
  user_type: string;
  region: string;
  industry: string;
  interests: string[];
  startup_years: string;
  onboarding_completed: boolean;
  schema_version: number;
}

export const USER_TYPE_OPTIONS = [
  { value: "pre_startup", label: "예비창업자" },
  { value: "sole_proprietor", label: "개인사업자" },
  { value: "small_business", label: "소상공인" },
  { value: "sme", label: "중소기업" },
  { value: "job_seeker_worker", label: "취업준비생·직장인" },
  { value: "other", label: "기타" },
] as const;

export const REGION_OPTIONS = [
  { value: "nationwide", label: "전국" },
  { value: "seoul", label: "서울" },
  { value: "busan", label: "부산" },
  { value: "daegu", label: "대구" },
  { value: "incheon", label: "인천" },
  { value: "gwangju", label: "광주" },
  { value: "daejeon", label: "대전" },
  { value: "ulsan", label: "울산" },
  { value: "sejong", label: "세종" },
  { value: "gyeonggi", label: "경기" },
  { value: "gangwon", label: "강원" },
  { value: "chungbuk", label: "충북" },
  { value: "chungnam", label: "충남" },
  { value: "jeonbuk", label: "전북" },
  { value: "jeonnam", label: "전남" },
  { value: "gyeongbuk", label: "경북" },
  { value: "gyeongnam", label: "경남" },
  { value: "jeju", label: "제주" },
] as const;

export const INDUSTRY_OPTIONS = [
  { value: "all", label: "업종 무관" },
  { value: "food", label: "음식·외식" },
  { value: "retail", label: "도소매·유통" },
  { value: "manufacturing", label: "제조업" },
  { value: "it_software", label: "IT·소프트웨어" },
  { value: "content_media", label: "콘텐츠·미디어" },
  { value: "tourism_hospitality", label: "관광·숙박" },
  { value: "education", label: "교육" },
  { value: "professional_services", label: "전문서비스" },
  { value: "agriculture_fishery", label: "농림수산" },
  { value: "other", label: "기타" },
] as const;

export const INTEREST_OPTIONS = [
  { value: "startup_support", label: "창업지원" },
  { value: "small_business_support", label: "소상공인 지원" },
  { value: "finance_loan_guarantee", label: "자금·대출·보증" },
  { value: "marketing_sales", label: "마케팅·판로" },
  { value: "employment_labor_cost", label: "고용·인건비" },
  { value: "technology_rnd", label: "기술·R&D" },
  { value: "export_global", label: "수출·해외진출" },
  { value: "education_consulting", label: "교육·컨설팅" },
  { value: "facility_digital", label: "시설·디지털전환" },
] as const;

export const STARTUP_YEAR_OPTIONS = [
  { value: "pre_startup", label: "예비창업" },
  { value: "under_1", label: "1년 미만" },
  { value: "years_1_3", label: "1~3년" },
  { value: "years_3_7", label: "3~7년" },
  { value: "over_7", label: "7년 이상" },
  { value: "not_applicable", label: "해당 없음" },
] as const;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type UserConditionStorageResult =
  | { success: true; data: UserCondition | null }
  | { success: false; error: "STORAGE_UNAVAILABLE" | "INVALID_CONDITION" };

const USER_TYPES = optionValues(USER_TYPE_OPTIONS);
const REGIONS = optionValues(REGION_OPTIONS);
const INDUSTRIES = optionValues(INDUSTRY_OPTIONS);
const INTERESTS = optionValues(INTEREST_OPTIONS);
const STARTUP_YEARS = optionValues(STARTUP_YEAR_OPTIONS);

export function normalizeUserCondition(value: unknown): UserCondition | null {
  if (!isRecord(value) || value.schema_version !== USER_CONDITION_SCHEMA_VERSION) return null;

  const userType = normalizedOption(value.user_type, USER_TYPES);
  const region = normalizedOption(value.region, REGIONS);
  const industry = normalizedOption(value.industry, INDUSTRIES);
  const startupYears = normalizedOption(value.startup_years, STARTUP_YEARS);
  const interests = normalizeInterests(value.interests);

  if (
    !userType ||
    !region ||
    !industry ||
    !startupYears ||
    interests === null ||
    interests.length === 0 ||
    typeof value.onboarding_completed !== "boolean"
  ) {
    return null;
  }

  return {
    user_type: userType,
    region,
    industry,
    interests,
    startup_years: userType === "job_seeker_worker" ? "not_applicable" : startupYears,
    onboarding_completed: value.onboarding_completed,
    schema_version: USER_CONDITION_SCHEMA_VERSION,
  };
}

export function readWebUserCondition(
  storage: StorageLike | null = browserStorage(),
): UserCondition | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(WEB_USER_CONDITION_STORAGE_KEY);
    return raw ? normalizeUserCondition(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function saveWebUserCondition(
  value: unknown,
  storage: StorageLike | null = browserStorage(),
): UserConditionStorageResult {
  const condition = normalizeUserCondition(value);
  if (!condition || !condition.onboarding_completed) {
    return { success: false, error: "INVALID_CONDITION" };
  }
  if (!storage) return { success: false, error: "STORAGE_UNAVAILABLE" };
  try {
    storage.setItem(WEB_USER_CONDITION_STORAGE_KEY, JSON.stringify(condition));
    dispatchConditionChanged();
    return { success: true, data: condition };
  } catch {
    return { success: false, error: "STORAGE_UNAVAILABLE" };
  }
}

export function updateWebUserCondition(
  updates: Partial<UserCondition>,
  storage: StorageLike | null = browserStorage(),
): UserConditionStorageResult {
  const current = readWebUserCondition(storage);
  if (!current) return { success: false, error: "INVALID_CONDITION" };
  return saveWebUserCondition({ ...current, ...updates }, storage);
}

export function clearWebUserCondition(
  storage: StorageLike | null = browserStorage(),
): UserConditionStorageResult {
  if (!storage) return { success: false, error: "STORAGE_UNAVAILABLE" };
  try {
    storage.removeItem(WEB_USER_CONDITION_STORAGE_KEY);
    dispatchConditionChanged();
    return { success: true, data: null };
  } catch {
    return { success: false, error: "STORAGE_UNAVAILABLE" };
  }
}

function normalizeInterests(value: unknown) {
  if (!Array.isArray(value)) return null;
  if (value.some((item) => typeof item !== "string")) return null;
  const cleaned = value
    .map((item) => (item as string).trim())
    .filter(Boolean);
  if (cleaned.some((item) => !INTERESTS.has(item))) {
    return null;
  }
  return [...new Set(cleaned)].sort();
}

function normalizedOption(value: unknown, options: Set<string>) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return options.has(normalized) ? normalized : null;
}

function optionValues(options: readonly { value: string }[]) {
  return new Set(options.map(({ value }) => value));
}

function browserStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function dispatchConditionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(USER_CONDITION_CHANGED_EVENT));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
