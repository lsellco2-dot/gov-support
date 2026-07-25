import { sanitizeDisplayText } from "@/lib/text/sanitize";
import {
  INTEGRATED_GWANGJU_JEONNAM_REGION,
  normalizeIntegratedRegionName,
} from "@/lib/regions";
import { stripHtml } from "../adapters/util";
import type {
  YouthCenterPolicy,
  YouthCenterRawRecord,
  YouthPolicyDateMode,
  YouthPolicyDomain,
  YouthPolicyStatus,
  YouthSourceStatus,
} from "./types";

export const YOUTHCENTER_REGIONS = [
  "전국",
  "서울",
  "부산",
  "대구",
  "인천",
  "광주",
  INTEGRATED_GWANGJU_JEONNAM_REGION,
  "대전",
  "울산",
  "세종",
  "경기",
  "강원",
  "충북",
  "충남",
  "전북",
  "전남",
  "경북",
  "경남",
  "제주",
] as const;

const LEGAL_REGION_PREFIX: Record<string, string> = {
  "11": "서울",
  "12": INTEGRATED_GWANGJU_JEONNAM_REGION,
  "26": "부산",
  "27": "대구",
  "28": "인천",
  "29": "광주",
  "30": "대전",
  "31": "울산",
  "36": "세종",
  "41": "경기",
  "42": "강원",
  "43": "충북",
  "44": "충남",
  "45": "전북",
  "46": "전남",
  "47": "경북",
  "48": "경남",
  "50": "제주",
  "51": "강원",
  "52": "전북",
};

const CURRENT_LOCAL_REGIONS = YOUTHCENTER_REGIONS.filter(
  (region) => !["전국", "광주", "전남"].includes(region),
);
const LEGACY_LOCAL_REGIONS = YOUTHCENTER_REGIONS.filter(
  (region) =>
    region !== "전국" && region !== INTEGRATED_GWANGJU_JEONNAM_REGION,
);

const LEGACY_REGION_CODES: Record<string, string> = {
  "003002001": "서울",
  "003002002": "부산",
  "003002003": "대구",
  "003002004": "인천",
  "003002005": "광주",
  "003002006": "대전",
  "003002007": "울산",
  "003002008": "경기",
  "003002009": "강원",
  "003002010": "충북",
  "003002011": "충남",
  "003002012": "전북",
  "003002013": "전남",
  "003002014": "경북",
  "003002015": "경남",
  "003002016": "제주",
  "003002017": "세종",
};

const PROVIDER_METHODS: Record<string, string> = {
  "0042001": "인프라 구축",
  "0042002": "프로그램",
  "0042003": "직접대출",
  "0042004": "공공기관",
  "0042005": "계약(위탁운영)",
  "0042006": "보조금",
  "0042007": "대출보증",
  "0042008": "공적보험",
  "0042009": "조세지출",
  "0042010": "바우처",
  "0042011": "정보제공",
  "0042012": "경제적 규제",
  "0042013": "기타",
};

const INCOME_CODES: Record<string, string> = {
  "0043001": "소득 무관",
  "0043002": "연소득 조건",
  "0043003": "기타 소득 조건",
};

const MAJOR_CODES: Record<string, string> = {
  "0011001": "인문계열",
  "0011002": "사회계열",
  "0011003": "상경계열",
  "0011004": "이학계열",
  "0011005": "공학계열",
  "0011006": "예체능계열",
  "0011007": "농산업계열",
  "0011008": "기타",
  "0011009": "전공 제한없음",
};

const EMPLOYMENT_CODES: Record<string, string> = {
  "0013001": "재직자",
  "0013002": "자영업자",
  "0013003": "미취업자",
  "0013004": "프리랜서",
  "0013005": "일용근로자",
  "0013006": "(예비)창업자",
  "0013007": "단기근로자",
  "0013008": "영농종사자",
  "0013009": "기타",
  "0013010": "취업요건 제한없음",
};

const EDUCATION_CODES: Record<string, string> = {
  "0049001": "고졸 미만",
  "0049002": "고교 재학",
  "0049003": "고졸 예정",
  "0049004": "고교 졸업",
  "0049005": "대학 재학",
  "0049006": "대졸 예정",
  "0049007": "대학 졸업",
  "0049008": "석·박사",
  "0049009": "기타",
  "0049010": "학력 제한없음",
};

const SPECIALTY_CODES: Record<string, string> = {
  "0014001": "중소기업",
  "0014002": "여성",
  "0014003": "기초생활수급자",
  "0014004": "한부모가정",
  "0014005": "장애인",
  "0014006": "농업인",
  "0014007": "군인",
  "0014008": "지역인재",
  "0014009": "기타",
  "0014010": "특화요건 제한없음",
};

export interface YouthCenterMapResult {
  policy: YouthCenterPolicy | null;
  error: string | null;
  dateParseFailed: boolean;
  missingFields: string[];
}

export function mapYouthCenterPolicy(
  raw: YouthCenterRawRecord,
  now = new Date(),
): YouthCenterMapResult {
  const sourceExternalId = pick(raw, [
    "plcyNo",
    "bizId",
    "polyBizId",
    "srchPolicyId",
  ]);
  const title = clean(pick(raw, ["plcyNm", "polyBizSjnm", "title"]));
  if (!sourceExternalId || !title) {
    return {
      policy: null,
      error: !sourceExternalId ? "정책 고유번호 누락" : "정책명 누락",
      dateParseFailed: false,
      missingFields: [],
    };
  }

  const summary = cleanText(
    pick(raw, ["plcyExplnCn", "polyItcnCn", "summary"]),
  );
  const support = cleanText(
    pick(raw, ["plcySprtCn", "sporCn", "supportContent"]),
  );
  const organization = clean(
    pick(raw, [
      "sprvsnInstCdNm",
      "cnsgNmor",
      "rgtrHghrkInstCdNm",
      "rgtrUpInstCdNm",
      "rgtrInstCdNm",
    ]),
  );
  const managingOrganization = clean(
    pick(raw, ["operInstCdNm", "tintNm", "managingOrganization"]),
  );
  const domain = normalizePolicyDomain(
    pick(raw, ["lclsfNm", "polyRlmNm"]),
    pick(raw, ["polyRlmCd", "bizTycdSel"]),
  );
  const middleCategory = clean(pick(raw, ["mclsfNm", "plcyTpNm"]));
  const providerMethod = decodeCodes(
    pick(raw, ["plcyPvsnMthdCd"]),
    PROVIDER_METHODS,
  );
  const supportType = joinNonEmpty(
    [policyDomainLabel(domain), middleCategory, providerMethod],
    " · ",
  );

  const periodText = pick(raw, ["aplyYmd", "rqutPrdCn", "applyPeriod"]);
  const periodCode = pick(raw, ["aplyPrdSeCd", "prdRpttSecd"]);
  const period = normalizeApplicationPeriod(periodText, periodCode, now);
  const region = normalizeYouthCenterRegion(raw);
  const ageMin = parseAge(pick(raw, ["sprtTrgtMinAge", "ageMin"]));
  const ageMax = parseAge(pick(raw, ["sprtTrgtMaxAge", "ageMax"]));
  const ageText = cleanText(pick(raw, ["ageInfo"]));
  const incomeCondition = joinNonEmpty([
    decodeCodes(pick(raw, ["earnCndSeCd"]), INCOME_CODES),
    amountRange(
      pick(raw, ["earnMinAmt"]),
      pick(raw, ["earnMaxAmt"]),
    ),
    cleanText(pick(raw, ["earnEtcCn", "prcpCn"])),
  ]);
  const educationCondition = firstNonEmpty([
    decodeCodes(pick(raw, ["schoolCd"]), EDUCATION_CODES),
    cleanText(pick(raw, ["accrRqisCn"])),
  ]);
  const employmentCondition = firstNonEmpty([
    decodeCodes(pick(raw, ["jobCd"]), EMPLOYMENT_CODES),
    cleanText(pick(raw, ["empmSttsCn"])),
  ]);
  const majorCondition = firstNonEmpty([
    decodeCodes(pick(raw, ["plcyMajorCd"]), MAJOR_CODES),
    cleanText(pick(raw, ["majrRqisCn"])),
  ]);
  const specialtyCondition = firstNonEmpty([
    decodeCodes(pick(raw, ["sBizCd", "sbizCd"]), SPECIALTY_CODES),
    cleanText(pick(raw, ["splzRlmRqisCn"])),
  ]);
  const additionalQualification = cleanText(
    pick(raw, ["addAplyQlfcCndCn", "aditRscn"]),
  );
  const participationLimit = cleanText(
    pick(raw, ["ptcpPrpTrgtCn", "prcpLmttTrgtCn"]),
  );
  const target = joinNonEmpty([
    ageText ?? ageRange(ageMin, ageMax),
    incomeCondition,
    educationCondition,
    employmentCondition,
    majorCondition,
    specialtyCondition,
    additionalQualification,
    participationLimit ? `참여 제한: ${participationLimit}` : null,
  ]);

  const applicationMethod = cleanText(
    pick(raw, ["plcyAplyMthdCn", "rqutProcCn"]),
  );
  const screeningMethod = cleanText(
    pick(raw, ["srngMthdCn", "jdgnPresCn"]),
  );
  const documents = cleanText(
    pick(raw, ["sbmsnDcmntCn", "presentnPapersNm"]),
  );
  const other = cleanText(pick(raw, ["etcMttrCn", "etct"]));
  const detailContent = sections([
    ["정책 설명", summary],
    ["지원 내용", support],
    ["신청 방법", applicationMethod],
    ["심사 방법", screeningMethod],
    ["제출 서류", documents],
    ["기타 사항", other],
  ]);
  const originalUrl = safeUrl(
    firstNonEmpty([
      pick(raw, ["refUrlAddr1", "rfcSiteUrla1"]),
      pick(raw, ["refUrlAddr2", "rfcSiteUrla2"]),
    ]),
  );
  const applicationUrl = safeUrl(
    pick(raw, ["aplyUrlAddr", "rqutUrla", "applicationUrl"]),
  );
  const sourceUpdatedAt = normalizeTimestamp(
    pick(raw, ["lastMdfcnDt", "frstRegDt", "frstRgstDt", "creatDt"]),
  );

  const inclusion = classifyInclusion({
    title,
    summary,
    support,
    detailContent,
    applicationUrl,
    originalUrl,
    period,
    domain,
    middleCategory,
  });
  const policy: YouthCenterPolicy = {
    sourceExternalId,
    title,
    summary,
    detailContent,
    organization,
    managingOrganization,
    region: region.region,
    regions: region.regions,
    regionResolution: region.resolution,
    target,
    supportType,
    applyStart: period.start,
    applyEnd: period.end,
    dateMode: period.mode,
    status: period.status,
    sourceStatus: normalizeYouthSourceStatus(period.status, period.mode),
    originalUrl,
    applicationUrl,
    ageMin,
    ageMax,
    incomeCondition,
    educationCondition,
    employmentCondition,
    majorCondition,
    specialtyCondition,
    policyDomain: domain,
    sourceUpdatedAt,
    included: inclusion.included,
    inclusionReason: inclusion.reason,
    raw,
  };

  return {
    policy,
    error: null,
    dateParseFailed: period.parseFailed,
    missingFields: missingRequiredFields(policy),
  };
}

export function normalizePolicyDomain(
  label: string | null,
  legacyCode: string | null,
): YouthPolicyDomain {
  const value = `${label ?? ""} ${legacyCode ?? ""}`.replace(/\s/g, "");
  if (/일자리|취업|창업|023010/.test(value)) return "employment_startup";
  if (/주거|023020/.test(value)) return "housing";
  if (/교육|직업|훈련|023030/.test(value)) return "education_training";
  if (/복지|문화|금융|023040/.test(value)) return "finance_welfare_culture";
  if (/참여|권리|기반|인프라|023050/.test(value)) {
    return "participation_infrastructure";
  }
  return "unknown";
}

export function normalizeApplicationPeriod(
  text: string | null,
  code: string | null,
  now = new Date(),
) {
  const value = text?.trim() ?? "";
  let mode: YouthPolicyDateMode = "unknown";
  if (code === "0057002" || /상시|연중|수시/.test(value)) mode = "ongoing";
  else if (/예산\s*소진|소진\s*시/.test(value)) mode = "until_budget_exhausted";
  else if (/미정|추후\s*공고|별도\s*공지/.test(value)) mode = "undecided";

  const candidates = extractDates(value);
  let start: string | null = null;
  let end: string | null = null;
  if (candidates.length >= 2) {
    [start, end] = candidates;
    mode = "fixed";
  } else if (candidates.length === 1) {
    if (/까지|마감|종료/.test(value) && !/부터|시작/.test(value)) end = candidates[0];
    else start = candidates[0];
    mode = "fixed";
  }

  const parseFailed =
    Boolean(value) &&
    mode === "unknown" &&
    /\d{4}[^가-힣]{0,3}\d{1,2}[^가-힣]{0,3}\d{1,2}/.test(value);
  const today = seoulDate(now);
  let status: YouthPolicyStatus = "unknown";
  if (code === "0057003") status = "closed";
  else if (end && end < today) status = "closed";
  else if (start && start > today) status = "upcoming";
  else if (start || end) status = "open";
  else if (mode === "ongoing" || mode === "until_budget_exhausted") status = "ongoing";

  return { start, end, mode, status, parseFailed, raw: value || null };
}

export function normalizeYouthSourceStatus(
  status: YouthPolicyStatus,
  dateMode: YouthPolicyDateMode,
): YouthSourceStatus {
  if (status === "closed") return "closed";
  if (status === "upcoming") return "upcoming";
  if (
    status === "ongoing" ||
    dateMode === "ongoing" ||
    dateMode === "until_budget_exhausted"
  ) {
    return "always";
  }
  if (status === "open") return "open";
  return "unknown";
}

export function normalizeYouthCenterRegion(raw: YouthCenterRawRecord) {
  if (pick(raw, ["pvsnInstGroupCd"]) === "0054001") {
    return {
      region: "전국",
      regions: ["전국"],
      resolution: "nationwide" as const,
    };
  }

  const values = [
    ...splitCodes(pick(raw, ["zipCd"])),
    ...splitCodes(pick(raw, ["polyBizSecd", "srchPolyBizSecd"])),
  ];
  const regions = Array.from(
    new Set(
      values
        .map((value) => {
          if (/전국/.test(value)) return "전국";
          return (
            normalizeIntegratedRegionName(value) ??
            LEGACY_REGION_CODES[value] ??
            LEGAL_REGION_PREFIX[value.slice(0, 2)] ??
            null
          );
        })
        .filter((value): value is string => Boolean(value)),
    ),
  );

  if (
    regions.includes("전국") ||
    CURRENT_LOCAL_REGIONS.every((region) => regions.includes(region)) ||
    LEGACY_LOCAL_REGIONS.every((region) => regions.includes(region))
  ) {
    return {
      region: "전국",
      regions: ["전국"],
      resolution: "nationwide" as const,
    };
  }
  if (regions.length === 1) {
    return { region: regions[0], regions, resolution: "single" as const };
  }
  if (regions.length > 1) {
    return { region: null, regions, resolution: "multiple" as const };
  }
  return { region: null, regions: [], resolution: "unknown" as const };
}

function classifyInclusion(input: {
  title: string;
  summary: string | null;
  support: string | null;
  detailContent: string | null;
  applicationUrl: string | null;
  originalUrl: string | null;
  period: ReturnType<typeof normalizeApplicationPeriod>;
  domain: YouthPolicyDomain;
  middleCategory: string | null;
}) {
  const text = [
    input.title,
    input.summary,
    input.support,
    input.detailContent,
    input.middleCategory,
  ]
    .filter(Boolean)
    .join(" ");
  const actionable =
    Boolean(input.applicationUrl) ||
    Boolean(input.period.start || input.period.end) ||
    input.period.mode === "ongoing" ||
    /신청|접수|참여|모집/.test(text);
  const benefit =
    /수당|지원금|보조금|바우처|비용|교육|훈련|상담|월세|주거|대출|저축|자산형성|교통비|면접|자격증|창업|취업역량|프로그램/.test(
      text,
    );
  const planDocument =
    /기본계획|시행계획|정책방향|중점과제|연구자료/.test(input.title) &&
    /계획|추진|방향|과제|연구/.test(text) &&
    !actionable;
  const contentOnly =
    /뉴스|칼럼|인터뷰|보도자료|홍보|동향/.test(input.title) &&
    !benefit &&
    !actionable;
  const facilityOnly =
    /청년센터|청년공간|시설\s*(목록|안내)|공간\s*(목록|안내)/.test(text) &&
    !benefit &&
    !actionable;
  const directHire =
    /채용\s*(공고|모집)|구인|인턴\s*(채용|모집)/.test(input.title) &&
    /근무지|급여|연봉|채용인원|직무|고용형태/.test(text) &&
    !/취업지원|교육|훈련|수당|프로그램|일경험\s*프로그램/.test(text);

  if (input.period.status === "closed") {
    return { included: false, reason: "신청기간 마감" };
  }
  if (planDocument) return { included: false, reason: "기본계획·정책방향 문서" };
  if (contentOnly) return { included: false, reason: "뉴스·홍보 콘텐츠" };
  if (facilityOnly) return { included: false, reason: "청년센터·공간 시설 정보" };
  if (directHire) return { included: false, reason: "일반 채용·인턴 공고" };
  if (
    input.domain !== "unknown" &&
    (actionable || benefit || Boolean(input.originalUrl))
  ) {
    return { included: true, reason: "정책 분류와 신청·지원 내용 확인" };
  }
  if (actionable && benefit) {
    return { included: true, reason: "신청 가능성과 실질 지원 내용 확인" };
  }
  return { included: false, reason: "신청·참여 가능한 지원정책 여부 불명확" };
}

function extractDates(value: string) {
  const matches = Array.from(
    value.matchAll(
      /(?<!\d)(\d{4})\s*(?:[.\-/년]\s*)?(\d{1,2})\s*(?:[.\-/월]\s*)?(\d{1,2})(?:\s*일)?(?!\d)/g,
    ),
  );
  return Array.from(
    new Set(
      matches
        .map((match) => validDate(match[1], match[2], match[3]))
        .filter((date): date is string => Boolean(date)),
    ),
  );
}

function validDate(year: string, month: string, day: string) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  ) {
    return null;
  }
  return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function normalizeTimestamp(value: string | null) {
  if (!value) return null;
  const normalized = value
    .trim()
    .replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, "$1-$2-$3T$4:$5:$6")
    .replace(" ", "T");
  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function missingRequiredFields(policy: YouthCenterPolicy) {
  const fields: Array<[string, unknown]> = [
    ["summary", policy.summary],
    ["detail_content", policy.detailContent],
    ["organization", policy.organization],
    ["managing_organization", policy.managingOrganization],
    ["region", policy.region],
    ["target", policy.target],
    ["supportType", policy.supportType],
    ["apply_start", policy.applyStart],
    ["apply_end", policy.applyEnd],
    ["original_url", policy.originalUrl],
    ["application_url", policy.applicationUrl],
    ["age_min", policy.ageMin],
    ["age_max", policy.ageMax],
    ["income_condition", policy.incomeCondition],
    ["education_condition", policy.educationCondition],
    ["employment_condition", policy.employmentCondition],
    ["major_condition", policy.majorCondition],
    ["specialty_condition", policy.specialtyCondition],
    ["source_updated_at", policy.sourceUpdatedAt],
  ];
  return fields.filter(([, value]) => value === null).map(([field]) => field);
}

function policyDomainLabel(domain: YouthPolicyDomain) {
  const labels: Record<YouthPolicyDomain, string | null> = {
    employment_startup: "일자리·취업·창업",
    housing: "주거",
    education_training: "교육·직업·훈련",
    finance_welfare_culture: "금융·복지·문화",
    participation_infrastructure: "참여·기반",
    unknown: null,
  };
  return labels[domain];
}

function pick(raw: YouthCenterRawRecord, keys: string[]) {
  const entries = new Map(
    Object.entries(raw).map(([key, value]) => [key.toLowerCase(), value]),
  );
  for (const key of keys) {
    const value = entries.get(key.toLowerCase());
    const scalar = Array.isArray(value) ? value.find(Boolean) : value;
    if (scalar?.trim()) return scalar.trim();
  }
  return null;
}

function clean(value: string | null) {
  const sanitized = sanitizeDisplayText(value);
  return sanitized || null;
}

function cleanText(value: string | null) {
  return clean(stripHtml(value));
}

function firstNonEmpty(values: Array<string | null>) {
  return values.find((value): value is string => Boolean(value?.trim())) ?? null;
}

function joinNonEmpty(values: Array<string | null>, separator = "\n") {
  const result = Array.from(
    new Set(values.filter((value): value is string => Boolean(value?.trim()))),
  );
  return result.length > 0 ? result.join(separator) : null;
}

function sections(values: Array<[string, string | null]>) {
  const result = values
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([label, value]) => `[${label}]\n${value}`);
  return result.length > 0 ? result.join("\n\n") : null;
}

function splitCodes(value: string | null) {
  return value
    ? value.split(/[\s,;|/]+/).map((item) => item.trim()).filter(Boolean)
    : [];
}

function decodeCodes(value: string | null, labels: Record<string, string>) {
  return joinNonEmpty(
    splitCodes(value).map((code) => labels[code] ?? code),
    ", ",
  );
}

function parseAge(value: string | null) {
  if (!value) return null;
  const match = value.match(/\d{1,3}/);
  if (!match) return null;
  const age = Number(match[0]);
  return age >= 0 && age <= 120 ? age : null;
}

function ageRange(min: number | null, max: number | null) {
  if (min !== null && max !== null) return `만 ${min}세~${max}세`;
  if (min !== null) return `만 ${min}세 이상`;
  if (max !== null) return `만 ${max}세 이하`;
  return null;
}

function amountRange(min: string | null, max: string | null) {
  if (min && max) return `소득 ${min}~${max}`;
  if (min) return `소득 ${min} 이상`;
  if (max) return `소득 ${max} 이하`;
  return null;
}

function safeUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function seoulDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
