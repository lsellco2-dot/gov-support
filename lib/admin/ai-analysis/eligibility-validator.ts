import type { GrantAnalysisInput } from "@/lib/admin/ai-analysis/types";
import type {
  EligibilityComparison,
  EligibilityDimension,
  EligibilityFact,
  EligibilityFacts,
  EligibilityStrength,
  EligibilityStatus,
  EligibilityValidation,
} from "@/lib/admin/ai-analysis/eligibility-types";

type Profile = GrantAnalysisInput["profile"];
type Candidate = GrantAnalysisInput["candidates"][number];

const DIMENSION_LABELS: Record<EligibilityDimension, string> = {
  gender: "성별",
  age: "연령",
  education: "학위",
  major: "전공",
  startupStatus: "창업 상태",
  startupYears: "업력",
  businessType: "사업자 유형",
  employmentStatus: "고용상태",
  regionProvince: "시·도",
  regionDistrict: "시·군·구",
  income: "소득·매출",
  otherRequirements: "기타 자격조건",
};

export function validateEligibility(
  profile: Profile,
  candidate: Candidate,
): EligibilityValidation {
  const user = buildUserEligibilityFacts(profile);
  const announcement = buildAnnouncementEligibilityFacts(candidate);
  const comparisons = compareEligibilityFacts(user, announcement);
  const required = comparisons.filter(({ strength }) => strength === "REQUIRED");
  return {
    user,
    announcement,
    comparisons,
    mismatch: required.filter(({ status }) => status === "MISMATCH"),
    unknown: required.filter(({ status }) => status === "UNKNOWN"),
    matched: comparisons.filter(({ status }) => status === "MATCH"),
    preferred: comparisons.filter(({ strength }) => strength === "PREFERRED"),
  };
}

export function buildUserEligibilityFacts(profile: Profile): EligibilityFacts {
  return {
    gender: userGender(profile.gender),
    age: Number.isInteger(profile.birth_year)
      ? known(
          {
            min: new Date().getUTCFullYear() - Number(profile.birth_year) - 1,
            max: new Date().getUTCFullYear() - Number(profile.birth_year),
          },
          "profile",
        )
      : unknown("profile"),
    education: userEducation(profile.degree),
    major: profileText(profile.major),
    startupStatus: userStartupStatus(
      profile.user_type,
      profile.business_status,
    ),
    startupYears:
      profile.startup_years && profile.startup_years !== "not_applicable"
        ? profile.startup_years === "pre_startup"
          ? notApplicable()
          : known(profile.startup_years, "profile")
        : unknown("profile"),
    businessType: userBusinessType(profile.user_type),
    employmentStatus: userEmployment(profile.employment_status),
    regionProvince: userProvince(profile.region),
    regionDistrict: userDistrict(profile.region_district),
    income: Number.isFinite(profile.annual_revenue)
      ? known(Number(profile.annual_revenue), "profile")
      : unknown("profile"),
    otherRequirements: profile.other_qualifications?.length
      ? known(profile.other_qualifications, "profile")
      : unknown("profile"),
  };
}

export function buildAnnouncementEligibilityFacts(
  candidate: Candidate,
): EligibilityFacts {
  const context = announcementEligibilityContext(candidate);
  const region = regionRequirementFromContext(context);
  const age = announcementAge(candidate, context);
  return {
    gender: requirementFromContext(context, announcementGender),
    age,
    education: announcementEducation(context),
    major: announcementMajor(context),
    startupStatus: requirementFromContext(context, announcementStartupStatus),
    startupYears: requirementFromContext(context, announcementStartupYears),
    businessType: requirementFromContext(context, announcementBusinessType),
    employmentStatus: announcementEmployment(context),
    regionProvince: region.provinces.length
      ? known(region.provinces, region.source, region.strength)
      : notApplicable(),
    regionDistrict: region.districts.length
      ? known(region.districts, region.source, region.strength)
      : notApplicable(),
    income: requirementFromContext(context, announcementIncome),
    otherRequirements: requirementFromContext(
      context,
      announcementOtherRequirements,
    ),
  };
}

export function compareEligibilityFacts(
  user: EligibilityFacts,
  announcement: EligibilityFacts,
) {
  return (Object.keys(DIMENSION_LABELS) as EligibilityDimension[]).map(
    (dimension): EligibilityComparison => ({
      dimension,
      status:
        dimension === "startupYears" &&
        user.startupStatus.value === "PRE_STARTUP" &&
        (announcement.startupStatus.value === "PRE_STARTUP_ONLY" ||
          announcement.startupStatus.value === "BOTH")
          ? "NOT_APPLICABLE"
          : compareDimension(
              dimension,
              user[dimension],
              announcement[dimension],
            ),
      userValue: user[dimension].value,
      requirementValue: announcement[dimension].value,
      source: announcement[dimension].source,
      strength: announcement[dimension].strength,
      label: DIMENSION_LABELS[dimension],
    }),
  );
}

function compareDimension(
  dimension: EligibilityDimension,
  user: EligibilityFact<unknown>,
  requirement: EligibilityFact<unknown>,
): EligibilityStatus {
  if (requirement.state === "NOT_APPLICABLE") return "NOT_APPLICABLE";
  if (requirement.state === "UNKNOWN" || user.state === "UNKNOWN") return "UNKNOWN";
  if (user.state === "NOT_APPLICABLE") return "MISMATCH";

  if (dimension === "startupStatus") {
    const actual = String(user.value);
    const required = String(requirement.value);
    if (required === "BOTH") return "MATCH";
    if (required === "PRE_STARTUP_ONLY") return actual === "PRE_STARTUP" ? "MATCH" : "MISMATCH";
    if (required === "EXISTING_ONLY") return actual === "EXISTING" ? "MATCH" : "MISMATCH";
  }
  if (dimension === "regionProvince" || dimension === "regionDistrict") {
    const actual = user.value as string[];
    const required = requirement.value as string[];
    return required.some((value) => actual.includes(value)) ? "MATCH" : "MISMATCH";
  }
  if (dimension === "age" || dimension === "income") {
    return compareNumberRange(user.value, requirement.value);
  }
  if (dimension === "startupYears") {
    return compareStartupYears(String(user.value), requirement.value);
  }
  if (dimension === "education") {
    return compareEducation(String(user.value), String(requirement.value));
  }
  if (
    dimension === "gender" ||
    dimension === "employmentStatus"
  ) {
    return normalize(String(user.value)) === normalize(String(requirement.value))
      ? "MATCH"
      : "MISMATCH";
  }
  if (dimension === "businessType") {
    return compareBusinessType(String(user.value), String(requirement.value));
  }
  if (dimension === "otherRequirements") {
    const actual = user.value as string[];
    const required = requirement.value as string[];
    return required.every((value) => actual.some((item) => includesEither(item, value)))
      ? "MATCH"
      : "MISMATCH";
  }
  return includesEither(String(user.value), String(requirement.value))
    ? "MATCH"
    : "MISMATCH";
}

interface EligibilityTextContext {
  required: string;
  preferred: string;
  structuredRequired: string;
  structuredPreferred: string;
}

function announcementEligibilityContext(
  candidate: Candidate,
): EligibilityTextContext {
  const general = splitConditionStrength(
    [
      candidate.target,
      extractEligibilitySections(candidate.detailContent),
      extractExplicitRequirementClauses(candidate.detailContent),
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n"),
  );
  const structured = splitConditionStrength(
    [
      candidate.educationCondition,
      candidate.employmentCondition,
      candidate.majorCondition,
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n"),
  );
  return {
    required: general.required,
    preferred: general.preferred,
    structuredRequired: structured.required,
    structuredPreferred: structured.preferred,
  };
}

function splitConditionStrength(value: string) {
  if (!value) return { required: "", preferred: "" };
  const prepared = value
    .replace(
      /([○●■□※]\s*)?(?=(?:우대\s*(?:사항|대상)?|가산점|가점|우선\s*(?:선발|지원|고려))\s*[:：])/g,
      "\n",
    )
    .replace(/([.!?])\s+/g, "$1\n");
  const required: string[] = [];
  const preferred: string[] = [];

  for (const line of prepared.split(/[\n;；]+/)) {
    const clause = line.trim();
    if (!clause) continue;
    const marker = clause.search(PREFERRED_MARKER);
    if (marker < 0) {
      required.push(clause);
      continue;
    }

    const boundary = Math.max(
      clause.lastIndexOf(",", marker),
      clause.lastIndexOf("，", marker),
    );
    if (boundary >= 0) {
      const requiredPrefix = clause.slice(0, boundary).trim();
      if (requiredPrefix) required.push(requiredPrefix);
      preferred.push(clause.slice(boundary + 1).trim());
    } else {
      preferred.push(clause);
    }
  }
  return { required: required.join("\n"), preferred: preferred.join("\n") };
}

const PREFERRED_MARKER =
  /(?:우대\s*(?:사항|대상)?|가산점|가점|우선\s*(?:선발|지원|고려)|권장|선호)/i;

function extractEligibilitySections(value: string | null) {
  if (!value) return "";
  const heading =
    /(?:^|\n)(?:신청대상|지원대상|신청자격|지원자격|참여대상)\s*[:：]?\s*/g;
  const matches = [...value.matchAll(heading)];
  if (matches.length === 0) return "";
  return matches
    .map((match, index) => {
      const start = (match.index ?? 0) + match[0].length;
      const nextEligibility = matches[index + 1]?.index ?? value.length;
      const section = value.slice(start, Math.min(nextEligibility, start + 4_000));
      const stop = section.search(ELIGIBILITY_SECTION_STOP);
      return stop >= 0 ? section.slice(0, stop) : section;
    })
    .join("\n");
}

const ELIGIBILITY_SECTION_STOP =
  /\n(?:제외대상|신청방법|제출서류|선정절차|평가방법|지원내용|문의처|접수처|행사안내|유의사항)\s*[:：]?/;

function extractExplicitRequirementClauses(value: string | null) {
  if (!value) return "";
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line &&
        line.length <= 500 &&
        EXPLICIT_REQUIREMENT_MARKER.test(line) &&
        !NON_ELIGIBILITY_CONTEXT.test(line),
    )
    .join("\n");
}

const EXPLICIT_REQUIREMENT_MARKER =
  /(?:필수|에\s*한함|만\s*(?:신청|지원)\s*가능|신청\s*(?:불가|제외)|지원\s*(?:불가|제외)|예비\s*창업자?\s*제외|사업자등록을\s*완료)/i;
const NON_ELIGIBILITY_CONTEXT =
  /(?:제출서류|신청방법|지원내용|문의처|접수처|첨부|증빙|서류)/i;

function requirementFromContext<T>(
  context: EligibilityTextContext,
  parse: (
    text: string,
    strength: EligibilityStrength,
    source: EligibilityFact<T>["source"],
  ) => EligibilityFact<T>,
): EligibilityFact<T> {
  const required = parse(context.required, "REQUIRED", "eligibility_text");
  if (required.state !== "NOT_APPLICABLE") return required;
  return parse(context.preferred, "PREFERRED", "eligibility_text");
}

function announcementStartupStatus(
  text: string,
  strength: EligibilityStrength,
  source: EligibilityFact<unknown>["source"],
): EligibilityFacts["startupStatus"] {
  const normalized = text.replace(/\(\s*예비\s*\)/g, "예비");
  const excludesPreStartup =
    /예비\s*창업자?\s*(?:는|은)?\s*(?:제외|신청\s*불가|지원\s*불가)|예비\s*창업\s*불가/i.test(
      normalized,
    );
  const existingOnly =
    /(?:사업자등록을\s*완료한\s*(?:기업|사업자)\s*만|기존\s*사업자(?:에\s*한함|만\s*신청\s*가능)|창업\s*기업\s*만\s*(?:신청|지원)\s*가능)/i.test(
      normalized,
    );
  const prospectiveRepresentative =
    /예비\s*(?:여성\s*)?(?:CEO|기업\s*대표(?:자)?|대표이사)/i.test(
      normalized,
    );
  const existingRepresentative =
    !prospectiveRepresentative &&
    /(?:여성\s*)?CEO|여성\s*기업\s*대표(?:자)?|기업\s*대표(?:자)?|대표이사|기존\s*기업(?:의)?\s*대표/i.test(
      normalized,
    );
  const preStartup =
    !excludesPreStartup &&
    (/(?:예비\s*창업(?:자|기업)?|예비\s*(?:및|또는|[·ㆍ/,])\s*초기\s*창업(?:자|기업)?|창업\s*예정|미창업)/i.test(
      normalized,
    ) ||
      prospectiveRepresentative);
  const existing =
    /기창업|기존\s*사업자|초기\s*창업(?:자|기업)|창업\s*기업|창업\s*\d+년\s*이내\s*(?:기업|사업자)|사업자등록|법인|소상공인|중소기업/i.test(
      normalized,
    ) || existingRepresentative;
  if (excludesPreStartup || existingOnly || (existing && !preStartup)) {
    return known("EXISTING_ONLY", source, strength);
  }
  if (preStartup && existing) return known("BOTH", source, strength);
  if (preStartup) return known("PRE_STARTUP_ONLY", source, strength);
  if (/(?:창업자|사업자|기업)\s*(?:대상|만|신청|지원)?/i.test(normalized)) {
    return unknown(source, strength);
  }
  return notApplicable();
}

function announcementStartupYears(
  text: string,
  strength: EligibilityStrength,
  source: EligibilityFact<unknown>["source"],
): EligibilityFacts["startupYears"] {
  const max = firstNumber(text, /(?:업력|창업|설립)[^\n]{0,25}?(\d+)년\s*이내/i);
  return max === null
    ? notApplicable()
    : known({ min: 0, max }, source, strength);
}

function announcementGender(
  text: string,
  strength: EligibilityStrength,
  source: EligibilityFact<unknown>["source"],
): EligibilityFacts["gender"] {
  const female =
    /여성\s*(?:\(\s*예비\s*\)\s*|예비\s*)?(?:창업자|기업(?:\s*대표(?:자)?)?|CEO|대표자)|여성\s*(?:만|전용|대상)/i.test(
      text,
    ) || (strength === "PREFERRED" && /여성|여자/i.test(text));
  const male =
    /남성\s*(?:\(\s*예비\s*\)\s*|예비\s*)?(?:창업자|기업(?:\s*대표(?:자)?)?|CEO|대표자)|남성\s*(?:만|전용|대상)/i.test(
      text,
    ) || (strength === "PREFERRED" && /남성|남자/i.test(text));
  if (female && !male) return known("female", source, strength);
  if (male && !female) return known("male", source, strength);
  return notApplicable();
}

function announcementEducation(
  context: EligibilityTextContext,
): EligibilityFacts["education"] {
  for (const [text, source, strength] of contextSources(context)) {
    if (/석\s*[·ㆍ/]?\s*박사|석사\s*이상|박사/i.test(text)) {
      return known("graduate", source, strength);
    }
    if (/학사\s*이상|대졸/i.test(text)) {
      return known("bachelor", source, strength);
    }
  }
  return notApplicable();
}

function announcementMajor(
  context: EligibilityTextContext,
): EligibilityFacts["major"] {
  for (const [text, source, strength] of contextSources(context)) {
    const before = text.match(/([가-힣A-Za-z·ㆍ/ ]{2,40}?)\s*전공자(?:만|에\s*한함|\s|$)/i);
    if (before) return known(before[1].trim(), source, strength);
    const after = text.match(/(?:전공|학과|계열)\s*[:：]\s*([가-힣A-Za-z·ㆍ/ ]{2,40})/i);
    if (after) return known(after[1].trim(), source, strength);
    if (/이공계/i.test(text)) return known("이공계", source, strength);
  }
  return notApplicable();
}

function announcementAge(
  candidate: Candidate,
  context: EligibilityTextContext,
): EligibilityFacts["age"] {
  if (Number.isInteger(candidate.age_min) || Number.isInteger(candidate.age_max)) {
    return known(
      { min: candidate.age_min ?? null, max: candidate.age_max ?? null },
      "structured",
      "REQUIRED",
    );
  }
  return requirementFromContext(context, (text, strength, source) => {
    const explicitBounds = text.match(
      /(?:만\s*)?(\d{1,2})\s*세?\s*이상[^\n]{0,20}?(?:만\s*)?(\d{1,2})\s*세?\s*이하/i,
    );
    if (explicitBounds) {
      return known(
        { min: Number(explicitBounds[1]), max: Number(explicitBounds[2]) },
        source,
        strength,
      );
    }
    const between = text.match(/(?:만\s*)?(\d{1,2})\s*[~～~-]\s*(?:만\s*)?(\d{1,2})\s*세/i);
    if (between) {
      return known(
        { min: Number(between[1]), max: Number(between[2]) },
        source,
        strength,
      );
    }
    const birthYears = text.match(
      /(\d{4})\s*년?\s*[~～~-]\s*(\d{4})\s*년\s*(?:생|출생자)/i,
    );
    if (birthYears) {
      return known(
        ageRangeForBirthYears(Number(birthYears[1]), Number(birthYears[2])),
        source,
        strength,
      );
    }
    const bornAfter = text.match(
      /(\d{4})년(?:생)?\s*이후(?:\s*출생자)?/i,
    );
    if (bornAfter) {
      return known(
        {
          min: null,
          max: Math.max(0, new Date().getUTCFullYear() - Number(bornAfter[1])),
        },
        source,
        strength,
      );
    }
    const bornBefore = text.match(
      /(\d{4})년(?:생)?\s*이전(?:\s*출생자)?/i,
    );
    if (bornBefore) {
      return known(
        {
          min: Math.max(
            0,
            new Date().getUTCFullYear() - Number(bornBefore[1]) - 1,
          ),
          max: null,
        },
        source,
        strength,
      );
    }
    const min = firstNumber(text, /(?:만\s*)?(\d{1,2})\s*세\s*이상/i);
    if (min !== null) return known({ min, max: null }, source, strength);
    const max = firstNumber(text, /(?:만\s*)?(\d{1,2})\s*세\s*이하/i);
    return max === null
      ? notApplicable()
      : known({ min: null, max }, source, strength);
  });
}

function ageRangeForBirthYears(left: number, right: number) {
  const earlier = Math.min(left, right);
  const later = Math.max(left, right);
  const currentYear = new Date().getUTCFullYear();
  return {
    min: Math.max(0, currentYear - later - 1),
    max: Math.max(0, currentYear - earlier),
  };
}

function announcementBusinessType(
  text: string,
  strength: EligibilityStrength,
  source: EligibilityFact<unknown>["source"],
): EligibilityFacts["businessType"] {
  if (/소상공인\s*(?:만|대상)|소상공인기본법/i.test(text)) return known("small_business", source, strength);
  if (/중소기업\s*(?:만|대상)|중소기업기본법/i.test(text)) return known("sme", source, strength);
  if (/법인\s*(?:만|사업자)|법인기업/i.test(text)) return known("corporation", source, strength);
  return notApplicable();
}

function announcementEmployment(
  context: EligibilityTextContext,
): EligibilityFacts["employmentStatus"] {
  for (const [text, source, strength] of contextSources(context)) {
    if (/미취업|실업|구직자/i.test(text)) return known("unemployed", source, strength);
    if (/재직자|근로자|직장인/i.test(text)) return known("employed", source, strength);
  }
  return notApplicable();
}

function announcementIncome(
  text: string,
  strength: EligibilityStrength,
  source: EligibilityFact<unknown>["source"],
): EligibilityFacts["income"] {
  const max = firstNumber(text, /매출(?:액)?[^\n]{0,20}?([\d,.]+)\s*억원?\s*이하/i);
  return max === null
    ? notApplicable()
    : known({ min: null, max: max * 100_000_000 }, source, strength);
}

function announcementOtherRequirements(
  text: string,
  strength: EligibilityStrength,
  source: EligibilityFact<unknown>["source"],
): EligibilityFacts["otherRequirements"] {
  const requirements = [
    /(?:필수|보유)[^\n]{0,30}?(?:자격증|면허)/i.test(text) ? "자격증·면허" : null,
    /경력\s*\d+년\s*이상/i.test(text) ? "경력" : null,
  ].filter((value): value is string => Boolean(value));
  return requirements.length
    ? known(requirements, source, strength)
    : notApplicable();
}

function extractRegionRequirement(
  text: string,
  strength: EligibilityStrength,
  source: EligibilityFact<unknown>["source"],
) {
  const districts = extractDistrictRequirements(text);
  const provinces = Object.entries(PROVINCE_ALIASES).flatMap(([province, aliases]) =>
    aliases.some((alias) => hasRegionalEligibilityPhrase(text, alias)) ? [province] : [],
  );
  if (
    districts.some((district) =>
      SEOUL_DISTRICTS.some((knownDistrict) => knownDistrict === district),
    ) &&
    !provinces.includes("서울")
  ) {
    provinces.push("서울");
  }
  return {
    provinces: [...new Set(provinces)],
    districts,
    source,
    strength,
  };
}

function regionRequirementFromContext(context: EligibilityTextContext) {
  const required = extractRegionRequirement(
    context.required,
    "REQUIRED",
    "eligibility_text",
  );
  if (required.provinces.length > 0 || required.districts.length > 0) {
    return required;
  }
  return extractRegionRequirement(
    context.preferred,
    "PREFERRED",
    "eligibility_text",
  );
}

function contextSources(
  context: EligibilityTextContext,
): Array<[string, EligibilityFact<unknown>["source"], EligibilityStrength]> {
  return [
    [context.structuredRequired, "structured", "REQUIRED"],
    [context.required, "eligibility_text", "REQUIRED"],
    [context.structuredPreferred, "structured", "PREFERRED"],
    [context.preferred, "eligibility_text", "PREFERRED"],
  ].filter(([text]) => Boolean(text)) as Array<
    [string, EligibilityFact<unknown>["source"], EligibilityStrength]
  >;
}

function extractDistrictRequirements(text: string) {
  const namedDistricts = SEOUL_DISTRICTS.filter((district) =>
    hasRegionalEligibilityPhrase(text, district),
  );
  const genericDistricts = [...text.matchAll(/([가-힣]{2,10}(?:시|군|구))/g)]
    .map((match) => match[1])
    .filter(
      (district) =>
        !PROVINCE_ALIAS_VALUES.has(district) &&
        hasRegionalEligibilityPhrase(text, district),
    );
  return [...new Set([...namedDistricts, ...genericDistricts])];
}

function hasRegionalEligibilityPhrase(text: string, region: string) {
  const escaped = region.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(
    `(?:${escaped}.{0,35}(?:거주|주민등록|소재|사업장|본점|지점|필수|대상)|(?:거주|주민등록|소재|사업장|본점|지점|필수|대상).{0,35}${escaped})`,
    "i",
  ).test(text);
}

function userStartupStatus(
  userType: string,
  businessStatus: string | null | undefined,
): EligibilityFacts["startupStatus"] {
  if (businessStatus && !isUnknownText(businessStatus)) {
    if (/예비|미창업|사업자\s*없/i.test(businessStatus)) {
      return known("PRE_STARTUP", "profile");
    }
    if (/사업자|기창업|법인|개인사업|소상공인|중소기업/i.test(businessStatus)) {
      return known("EXISTING", "profile");
    }
  }
  if (userType === "pre_startup") return known("PRE_STARTUP", "profile");
  if (["sole_proprietor", "small_business", "sme"].includes(userType)) {
    return known("EXISTING", "profile");
  }
  return unknown("profile");
}

function userBusinessType(userType: string): EligibilityFacts["businessType"] {
  if (userType === "small_business") return known("small_business", "profile");
  if (userType === "sme") return known("sme", "profile");
  if (userType === "sole_proprietor") return known("sole_proprietor", "profile");
  return unknown("profile");
}

function userProvince(region: string): EligibilityFacts["regionProvince"] {
  const value = PROFILE_REGION_LABELS[region];
  return value ? known([value], "profile") : unknown("profile");
}

function profileText(value: string | null | undefined, array = false): EligibilityFact<any> {
  if (!value || isUnknownText(value)) {
    return unknown("profile");
  }
  return known(array ? [value.trim()] : value.trim(), "profile");
}

function userDistrict(
  value: string | null | undefined,
): EligibilityFacts["regionDistrict"] {
  if (!value || isUnknownText(value)) return unknown("profile");
  const districts = [...value.matchAll(/([가-힣]{2,10}(?:시|군|구))/g)].map(
    (match) => match[1],
  );
  return known(districts.length > 0 ? [...new Set(districts)] : [value.trim()], "profile");
}

function userGender(value: string | null | undefined): EligibilityFacts["gender"] {
  if (!value || isUnknownText(value)) return unknown("profile");
  if (/^(?:female|여성|여자)$/i.test(value.trim())) return known("female", "profile");
  if (/^(?:male|남성|남자)$/i.test(value.trim())) return known("male", "profile");
  return known(value.trim(), "profile");
}

function userEducation(
  value: string | null | undefined,
): EligibilityFacts["education"] {
  if (!value || isUnknownText(value)) return unknown("profile");
  const normalized = value.trim();
  if (/박사|doctor/i.test(normalized)) return known("doctorate", "profile");
  if (/석사|master/i.test(normalized)) return known("master", "profile");
  if (/학사|bachelor|대졸/i.test(normalized)) return known("bachelor", "profile");
  return known(normalized, "profile");
}

function userEmployment(
  value: string | null | undefined,
): EligibilityFacts["employmentStatus"] {
  if (!value || isUnknownText(value)) return unknown("profile");
  const normalized = value.trim();
  if (/미취업|실업|구직/i.test(normalized)) return known("unemployed", "profile");
  if (/재직|근로|직장/i.test(normalized)) return known("employed", "profile");
  return known(normalized, "profile");
}

function isUnknownText(value: string) {
  return /^(?:unknown|not[_ -]?provided|미입력|모름|불명|해당\s*없음)$/i.test(
    value.trim(),
  );
}

function compareNumberRange(value: unknown, requirement: unknown): EligibilityStatus {
  const actual = numericRange(value);
  const required = numericRange(requirement);
  if (!actual || !required) return "UNKNOWN";
  if (
    (required.min !== null && actual.max !== null && actual.max < required.min) ||
    (required.max !== null && actual.min !== null && actual.min > required.max)
  ) {
    return "MISMATCH";
  }
  if (
    (required.min === null || (actual.min !== null && actual.min >= required.min)) &&
    (required.max === null || (actual.max !== null && actual.max <= required.max))
  ) {
    return "MATCH";
  }
  return "UNKNOWN";
}

function numericRange(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { min: value, max: value };
  }
  if (!value || typeof value !== "object") return null;
  const { min, max } = value as { min?: unknown; max?: unknown };
  const normalizedMin = min === null ? null : Number(min);
  const normalizedMax = max === null ? null : Number(max);
  if (
    (normalizedMin !== null && !Number.isFinite(normalizedMin)) ||
    (normalizedMax !== null && !Number.isFinite(normalizedMax))
  ) {
    return null;
  }
  return { min: normalizedMin, max: normalizedMax };
}

function compareStartupYears(value: string, requirement: unknown): EligibilityStatus {
  if (!requirement || typeof requirement !== "object") return "UNKNOWN";
  const required = requirement as { min: number | null; max: number | null };
  const range = STARTUP_YEAR_RANGES[value];
  if (!range) return "UNKNOWN";
  if (required.max !== null && range.min !== null && range.min > required.max) return "MISMATCH";
  if (required.max !== null && range.max !== null && range.max <= required.max) return "MATCH";
  return "UNKNOWN";
}

function compareEducation(value: string, requirement: string): EligibilityStatus {
  const actual = EDUCATION_RANK[normalize(value)];
  const required = EDUCATION_RANK[normalize(requirement)];
  if (actual === undefined || required === undefined) {
    return includesEither(value, requirement) ? "MATCH" : "UNKNOWN";
  }
  return actual >= required ? "MATCH" : "MISMATCH";
}

function compareBusinessType(value: string, requirement: string): EligibilityStatus {
  const actual = normalize(value);
  const required = normalize(requirement);
  if (actual === required) return "MATCH";
  if (required === "sme" && actual === "smallbusiness") return "MATCH";
  if (required === "smallbusiness" && actual === "soleproprietor") {
    return "UNKNOWN";
  }
  return "MISMATCH";
}

function includesEither(left: string, right: string) {
  const a = normalize(left);
  const b = normalize(right);
  return a === b || a.includes(b) || b.includes(a);
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^0-9a-z가-힣]+/g, "");
}

function firstNumber(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function known<T>(
  value: T,
  source: EligibilityFact<T>["source"],
  strength: EligibilityStrength = "REQUIRED",
): EligibilityFact<T> {
  return { state: "KNOWN", value, source, strength };
}

function unknown<T>(
  source: EligibilityFact<T>["source"],
  strength: EligibilityStrength = "REQUIRED",
): EligibilityFact<T> {
  return { state: "UNKNOWN", value: null, source, strength };
}

function notApplicable<T>(): EligibilityFact<T> {
  return {
    state: "NOT_APPLICABLE",
    value: null,
    source: "none",
    strength: "UNKNOWN",
  };
}

const STARTUP_YEAR_RANGES: Record<string, { min: number | null; max: number | null }> = {
  under_1: { min: 0, max: 1 },
  years_1_3: { min: 1, max: 3 },
  years_3_7: { min: 3, max: 7 },
  over_7: { min: 7, max: null },
};

const EDUCATION_RANK: Record<string, number> = {
  bachelor: 1,
  학사: 1,
  master: 2,
  석사: 2,
  graduate: 2,
  석박사: 2,
  doctorate: 3,
  박사: 3,
};

const PROFILE_REGION_LABELS: Record<string, string> = {
  seoul: "서울", busan: "부산", daegu: "대구", incheon: "인천", gwangju: "광주",
  daejeon: "대전", ulsan: "울산", sejong: "세종", gyeonggi: "경기", gangwon: "강원",
  chungbuk: "충북", chungnam: "충남", jeonbuk: "전북", jeonnam: "전남",
  gyeongbuk: "경북", gyeongnam: "경남", jeju: "제주",
};

const PROVINCE_ALIASES: Record<string, string[]> = {
  서울: ["서울", "서울시", "서울특별시"], 부산: ["부산", "부산시", "부산광역시"],
  대구: ["대구", "대구시", "대구광역시"], 인천: ["인천", "인천시", "인천광역시"],
  광주: ["광주", "광주광역시"], 대전: ["대전", "대전시", "대전광역시"],
  울산: ["울산", "울산시", "울산광역시"], 세종: ["세종", "세종시"],
  경기: ["경기", "경기도"], 강원: ["강원", "강원도", "강원특별자치도"],
  충북: ["충북", "충청북도"], 충남: ["충남", "충청남도"],
  전북: ["전북", "전라북도", "전북특별자치도"], 전남: ["전남", "전라남도"],
  경북: ["경북", "경상북도"], 경남: ["경남", "경상남도"],
  제주: ["제주", "제주도", "제주특별자치도"],
};

const PROVINCE_ALIAS_VALUES = new Set(Object.values(PROVINCE_ALIASES).flat());

const SEOUL_DISTRICTS = [
  "강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구",
  "노원구", "도봉구", "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구",
  "성북구", "송파구", "양천구", "영등포구", "용산구", "은평구", "종로구", "중구", "중랑구",
] as const;
