import { validateEligibility } from "@/lib/admin/ai-analysis/eligibility-validator";
import {
  GRANT_ANALYSIS_CLASSIFICATIONS,
  type GrantAnalysisClassification,
  type GrantAnalysisInput,
  type GrantAnalysisResponse,
  type GrantAnalysisSafetyRule,
} from "@/lib/admin/ai-analysis/types";

export const GRANT_ANALYSIS_CLASSIFICATION_META: Record<
  GrantAnalysisClassification,
  { label: string; description: string }
> = {
  A: { label: "A", description: "조건 일치 가능성 높음" },
  B: { label: "B", description: "추가 조건 필요" },
  C: { label: "C", description: "관련 사업 검토" },
  EXCLUDE: { label: "제외", description: "지원 조건 불일치" },
};

const MAX_LIST_ITEMS = 8;
const MAX_TEXT_LENGTH = 500;

export function normalizeGrantAnalysisResponse(
  input: GrantAnalysisInput,
  response: GrantAnalysisResponse,
): GrantAnalysisResponse {
  const allowedIds = new Set(input.candidates.map(({ id }) => id));
  const candidateById = new Map(
    input.candidates.map((candidate) => [candidate.id, candidate]),
  );
  const seenIds = new Set<number>();
  const results = response.results.flatMap((raw) => {
    if (!allowedIds.has(raw.announcementId) || seenIds.has(raw.announcementId)) {
      return [];
    }
    seenIds.add(raw.announcementId);

    const rawClassification = validClassification(raw.classification)
      ? raw.classification
      : "C";
    const rawReasons = textList(raw.reasons);
    const rawEvidence = textList(raw.evidence);
    const rawEvidenceIds = textList(raw.evidenceIds);
    const rawMissingConditions = textList(raw.missingConditions);
    const rawCautions = textList(raw.cautions);
    const rawConfidence = finiteRange(raw.confidence, 0, 1);
    const candidate = candidateById.get(raw.announcementId);
    const enforceProviderSafety = response.provider !== "mock";

    let classification = rawClassification;
    let reasons = rawReasons.filter(hasKoreanExplanation);
    let evidence = rawEvidence;
    let missingConditions = rawMissingConditions.filter(hasKoreanExplanation);
    let cautions = rawCautions.filter(hasKoreanExplanation);
    let confidence = rawConfidence;
    let requiresVerification = Boolean(raw.requiresVerification);
    const safetyRules: GrantAnalysisSafetyRule[] = [];

    const nonKoreanRemoved =
      reasons.length !== rawReasons.length ||
      missingConditions.length !== rawMissingConditions.length ||
      cautions.length !== rawCautions.length;
    if (enforceProviderSafety && nonKoreanRemoved) {
      if (classification === "A" || classification === "EXCLUDE") {
        classification = "B";
      }
      confidence = Math.min(confidence, 0.69);
      requiresVerification = true;
      addUnique(cautions, NON_KOREAN_OUTPUT_CAUTION);
      safetyRules.push("non_korean_output_removed");
    }

    const validation =
      enforceProviderSafety && candidate
        ? validateEligibility(input.profile, candidate)
        : null;
    const hasExplicitRegionRequirement = Boolean(
      validation &&
        (validation.announcement.regionProvince.state !== "NOT_APPLICABLE" ||
          validation.announcement.regionDistrict.state !== "NOT_APPLICABLE"),
    );
    if (
      enforceProviderSafety &&
      candidate &&
      !hasExplicitRegionRequirement
    ) {
      const filteredReasons = reasons.filter(
        (value) => !isRegionMetadataEligibilityClaim(value, candidate),
      );
      const filteredEvidence = evidence.filter(
        (value) => !isRegionMetadataEligibilityClaim(value, candidate),
      );
      const filteredMissingConditions = missingConditions.filter(
        (value) => !isRegionMetadataEligibilityClaim(value, candidate),
      );
      const filteredCautions = cautions.filter(
        (value) => !isRegionMetadataEligibilityClaim(value, candidate),
      );
      if (
        filteredReasons.length !== reasons.length ||
        filteredEvidence.length !== evidence.length ||
        filteredMissingConditions.length !== missingConditions.length ||
        filteredCautions.length !== cautions.length
      ) {
        reasons = filteredReasons;
        evidence = filteredEvidence;
        missingConditions = filteredMissingConditions;
        cautions = filteredCautions;
        requiresVerification = true;
        safetyRules.push("region_metadata_not_eligibility");
      }
    }
    if (enforceProviderSafety && validation) {
      const filteredReasons = reasons.filter(
        (value) =>
          !isUnsupportedAnnouncementCondition(value, validation, evidence),
      );
      const filteredMissingConditions = missingConditions.filter(
        (value) =>
          !isUnsupportedAnnouncementCondition(value, validation, evidence),
      );
      const filteredCautions = cautions.filter(
        (value) =>
          !isUnsupportedAnnouncementCondition(value, validation, evidence),
      );
      if (
        filteredReasons.length !== reasons.length ||
        filteredMissingConditions.length !== missingConditions.length ||
        filteredCautions.length !== cautions.length
      ) {
        reasons = filteredReasons;
        missingConditions = filteredMissingConditions;
        cautions = filteredCautions;
        if (classification === "A" || classification === "EXCLUDE") {
          classification = "B";
          confidence = Math.min(confidence, 0.69);
        }
        requiresVerification = true;
        safetyRules.push("unsupported_announcement_condition_removed");
      }
    }
    const mismatches = validation?.mismatch ?? [];
    const unknowns = validation?.unknown ?? [];

    if (mismatches.length > 0) {
      classification = "EXCLUDE";
      if (rawClassification !== "EXCLUDE") {
        confidence = Math.min(confidence, 0.79);
      }
      addUnique(
        reasons,
        `구조화된 자격조건에서 ${mismatches.map(({ label }) => label).join("·")} 불일치가 확인됩니다.`,
      );
      if (unknowns.length > 0) requiresVerification = true;
      safetyRules.push("eligibility_mismatch_enforced");
    } else if (unknowns.length > 0) {
      classification = "B";
      confidence = Math.min(confidence, 0.69);
      requiresVerification = true;
      for (const { label } of unknowns) {
        addUnique(missingConditions, `${label} 확인 필요`);
      }
      addUnique(cautions, ELIGIBILITY_UNKNOWN_CAUTION);
      safetyRules.push("eligibility_unknown_requires_review");
    } else if (enforceProviderSafety && rawClassification === "EXCLUDE") {
      classification = "B";
      confidence = Math.min(confidence, 0.69);
      requiresVerification = true;
      addUnique(cautions, UNVERIFIED_EXCLUDE_CAUTION);
      safetyRules.push("eligibility_unverified_exclude_to_b");
    }

    if (evidence.length === 0 && mismatches.length === 0) {
      if (classification === "A" || classification === "EXCLUDE") {
        classification = "C";
      }
      confidence = Math.min(confidence, 0.49);
      requiresVerification = true;
      addUnique(cautions, EVIDENCE_REQUIRED_CAUTION);
      safetyRules.push("evidence_required_downgrade");
    }

    return [
      {
        announcementId: raw.announcementId,
        classification,
        confidence,
        reasons:
          reasons.length > 0
            ? reasons
            : ["분석 사유를 확인할 수 없어 추가 검토가 필요합니다."],
        evidence,
        missingConditions,
        cautions: cautions.slice(0, MAX_LIST_ITEMS),
        requiresVerification:
          requiresVerification || cautions.length > 0 || missingConditions.length > 0,
        rawClassification,
        rawConfidence,
        rawReasons,
        rawEvidence,
        rawEvidenceIds,
        evidenceIds: rawEvidenceIds,
        rawMissingConditions,
        rawCautions,
        serverAdjusted:
          classification !== rawClassification ||
          confidence !== rawConfidence ||
          safetyRules.length > 0,
        safetyRules: [...new Set(safetyRules)],
      },
    ];
  });

  return {
    provider: safeLabel(response.provider, "unknown"),
    model: safeLabel(response.model, "unknown"),
    billingTier:
      response.billingTier === "free" || response.billingTier === "paid"
        ? response.billingTier
        : "unknown",
    inputTokens: nonNegativeInteger(response.inputTokens),
    outputTokens: nonNegativeInteger(response.outputTokens),
    thinkingTokens: nonNegativeInteger(response.thinkingTokens),
    totalTokens: nonNegativeInteger(response.totalTokens),
    durationMs: nonNegativeNumber(response.durationMs),
    totalDurationMs: nonNegativeNumber(response.totalDurationMs),
    estimatedCost: {
      amount: nonNegativeNumber(response.estimatedCost?.amount),
      currency: response.estimatedCost?.currency === "USD" ? "USD" : "KRW",
    },
    apiCalls: nonNegativeInteger(response.apiCalls),
    batchSizes: response.batchSizes?.flatMap((value) => {
      const size = nonNegativeInteger(value);
      return size > 0 ? [size] : [];
    }),
    results,
  };
}

const NON_KOREAN_OUTPUT_CAUTION =
  "한국어가 아닌 설명을 제거했으므로 공식 원문과 조건을 다시 확인해야 합니다.";
const ELIGIBILITY_UNKNOWN_CAUTION =
  "공고의 필수 자격조건과 비교할 사용자 정보가 부족해 추가 확인이 필요합니다.";
const UNVERIFIED_EXCLUDE_CAUTION =
  "구조화된 자격조건에서 명확한 불일치를 확인하지 못해 제외 판정을 완화했습니다.";
const EVIDENCE_REQUIRED_CAUTION =
  "확인 가능한 근거가 없어 공식 원문 확인이 필요합니다.";

function hasKoreanExplanation(value: string) {
  return /[가-힣]/.test(value);
}

function isRegionMetadataEligibilityClaim(
  value: string,
  candidate: GrantAnalysisInput["candidates"][number],
) {
  if (/region\s*metadata/i.test(value)) return true;
  const labels = [candidate.region, ...(candidate.regions ?? [])].flatMap(
    (label) => {
      const normalized = typeof label === "string" ? label.trim() : "";
      return normalized && !/^(?:전국|미확인)$/.test(normalized)
        ? [normalized]
        : [];
    },
  );
  if (!labels.some((label) => value.includes(label))) return false;
  return (
    /(?:지역|거주|소재|사업장|본점|지점|자격).{0,30}(?:일치|충족|부합|필수|조건|제한|대상)/i.test(
      value,
    ) ||
    /(?:일치|충족|부합|필수|조건|제한|대상).{0,30}(?:지역|거주|소재|사업장|본점|지점|자격)/i.test(
      value,
    )
  );
}

type EligibilityValidation = NonNullable<
  ReturnType<typeof validateEligibility>
>;

function isUnsupportedAnnouncementCondition(
  value: string,
  validation: EligibilityValidation,
  evidence: string[],
) {
  if (isGenericSpeculation(value) || isOrganizationBasedEligibilityGuess(value)) {
    return true;
  }

  const announcement = validation.announcement;
  const dimensions = claimedDimensions(value);
  return dimensions.some((dimension) => {
    const fact = announcement[dimension];
    if (fact.strength === "PREFERRED" && isRequiredEligibilityClaim(value)) {
      return true;
    }
    return (
      fact.state === "NOT_APPLICABLE" &&
      !isDimensionGroundedInEvidence(value, dimension, evidence)
    );
  });
}

function claimedDimensions(value: string) {
  if (!isEligibilityClaim(value)) return [];
  const dimensions: Array<keyof EligibilityValidation["announcement"]> = [];
  if (/(?:성별|여성|남성|여자|남자)/.test(value)) dimensions.push("gender");
  if (/(?:연령|나이|만\s*\d+\s*세|출생(?:연도|년도)?)/.test(value)) {
    dimensions.push("age");
  }
  if (/(?:학력|학위|석사|박사|대졸|졸업)/.test(value)) {
    dimensions.push("education");
  }
  if (/(?:전공|학과|이공계)/.test(value)) dimensions.push("major");
  if (/(?:예비\s*창업|초기\s*창업|창업기업)/.test(value)) {
    dimensions.push("startupStatus");
  }
  if (/(?:업력|창업\s*\d+\s*년)/.test(value)) {
    dimensions.push("startupYears");
  }
  if (/(?:사업자등록|법인|개인사업자|소상공인|중소기업|사업자\s*형태)/.test(value)) {
    dimensions.push("businessType");
  }
  if (/(?:재직|미취업|구직|근로자|취업\s*상태)/.test(value)) {
    dimensions.push("employmentStatus");
  }
  if (isProvinceEligibilityClaim(value)) dimensions.push("regionProvince");
  if (isDistrictEligibilityClaim(value)) dimensions.push("regionDistrict");
  if (/(?:매출|소득|중위소득)/.test(value)) dimensions.push("income");
  if (/(?:직원\s*수|종업원\s*수|상시근로자\s*수)/.test(value)) {
    dimensions.push("otherRequirements");
  }
  return [...new Set(dimensions)];
}

function isEligibilityClaim(value: string) {
  return /(?:자격|요건|조건|필수|전용|한함|제외|불일치|충족|부합|적합|신청\s*(?:가능|불가|대상)|지원\s*(?:가능|불가|대상|제한)|확인\s*필요)/.test(
    value,
  );
}

function isRequiredEligibilityClaim(value: string) {
  return /(?:필수|전용|한함|제외|불일치|반드시|충족해야|신청\s*(?:가능|불가)|지원\s*(?:가능|불가|제한)|자격|요건|확인\s*필요)/.test(
    value,
  );
}

function isProvinceEligibilityClaim(value: string) {
  return (
    /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(
      value,
    ) &&
    /(?:지역|거주|소재|사업장|본점|지점|이전|자격|조건|대상|신청|지원)/.test(
      value,
    )
  );
}

function isDistrictEligibilityClaim(value: string) {
  const hasDistrict =
    /(?:시[·ㆍ/]?군[·ㆍ/]?구|자치구|구체적인\s*거주지)/.test(value) ||
    extractDistrictLabels(value).length > 0;
  return (
    hasDistrict &&
    /(?:거주|소재|사업장|본점|지점|이전|자격|조건|대상|신청|지원|확인)/.test(
      value,
    )
  );
}

function extractDistrictLabels(value: string) {
  const provinceLevelCities = new Set([
    "서울시",
    "부산시",
    "대구시",
    "인천시",
    "광주시",
    "대전시",
    "울산시",
    "세종시",
  ]);
  return [
    ...value.matchAll(
      /(?:^|[\s,(])([가-힣]{2,6}(?:시|군|구))(?=$|[\s,.)])/g,
    ),
  ]
    .map((match) => match[1])
    .filter((label) => !provinceLevelCities.has(label));
}

function isDimensionGroundedInEvidence(
  value: string,
  dimension: keyof EligibilityValidation["announcement"],
  evidence: string[],
) {
  const terms = dimensionTerms(value, dimension);
  if (terms.length === 0) return false;
  return evidence.some((item) => {
    const normalizedEvidence = normalizeGroundingText(item);
    return terms.every((term) => normalizedEvidence.includes(term));
  });
}

function dimensionTerms(
  value: string,
  dimension: keyof EligibilityValidation["announcement"],
) {
  const patterns: Partial<
    Record<keyof EligibilityValidation["announcement"], RegExp>
  > = {
    gender: /성별|여성|남성|여자|남자/g,
    age: /연령|나이|만\s*\d+\s*세|\d{4}년\s*이후\s*출생/g,
    education: /학력|학위|석사|박사|대졸|졸업/g,
    major: /전공|학과|이공계/g,
    startupStatus: /예비\s*창업|초기\s*창업|창업기업/g,
    startupYears: /업력|창업\s*\d+\s*년/g,
    businessType: /사업자등록|법인|개인사업자|소상공인|중소기업/g,
    employmentStatus: /재직|미취업|구직|근로자|취업\s*상태/g,
    income: /매출|소득|중위소득/g,
    otherRequirements: /직원\s*수|종업원\s*수|상시근로자\s*수/g,
  };
  if (dimension === "regionProvince") {
    return (
      value.match(
        /서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주/g,
      ) ?? []
    ).map(normalizeGroundingText);
  }
  if (dimension === "regionDistrict") {
    return [
      ...extractDistrictLabels(value),
      ...(value.match(/시[·ㆍ/]?군[·ㆍ/]?구|자치구/g) ?? []),
    ].map(normalizeGroundingText);
  }
  return (value.match(patterns[dimension] ?? /$^/g) ?? []).map(
    normalizeGroundingText,
  );
}

function normalizeGroundingText(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

function isGenericSpeculation(value: string) {
  return (
    /(?:일반적으로|보통|통상적으로|대체로).{0,80}(?:필수|요구|제한|자격|조건|경쟁)/.test(
      value,
    ) ||
    /(?:경쟁이|경쟁률이?).{0,40}(?:높|치열)/.test(value)
  );
}

function isOrganizationBasedEligibilityGuess(value: string) {
  return /(?:기관|운영기관|주관기관|주최기관|재단|센터).{0,50}(?:특성|성격|소재|운영).{0,60}(?:자격|조건|제한|대상|필수|요구|신청|지원)/.test(
    value,
  );
}

function addUnique(values: string[], value: string) {
  if (!values.includes(value) && values.length < MAX_LIST_ITEMS) values.push(value);
}

function validClassification(
  value: unknown,
): value is GrantAnalysisClassification {
  return GRANT_ANALYSIS_CLASSIFICATIONS.includes(
    value as GrantAnalysisClassification,
  );
}

function textList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value.flatMap((item) => {
        if (typeof item !== "string") return [];
        const text = item.trim().slice(0, MAX_TEXT_LENGTH);
        return text ? [text] : [];
      }),
    ),
  ].slice(0, MAX_LIST_ITEMS);
}

function safeLabel(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, 100)
    : fallback;
}

function finiteRange(value: unknown, min: number, max: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

function nonNegativeInteger(value: unknown) {
  return Math.floor(nonNegativeNumber(value));
}

function nonNegativeNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}
