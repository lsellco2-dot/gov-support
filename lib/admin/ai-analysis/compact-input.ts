import { buildAnnouncementEligibilityFacts } from "@/lib/admin/ai-analysis/eligibility-validator";
import type {
  EligibilityDimension,
  EligibilityFact,
} from "@/lib/admin/ai-analysis/eligibility-types";
import type { GrantAnalysisInput } from "@/lib/admin/ai-analysis/types";

const MAX_EVIDENCE_ITEMS = 8;
const MAX_EVIDENCE_LENGTH = 700;
const MAX_SUPPORT_LENGTH = 500;

export interface CompactAnalysisEvidence {
  id: string;
  kind: "eligibility" | "support";
  text: string;
}

export interface CompactGrantAnalysisCandidate {
  announcementId: number;
  metadata: {
    title: string;
    organization: string | null;
    source: string;
    regionMetadata: string[];
    officialUrl: string | null;
  };
  existingRecommendationScore: number;
  categories: string[];
  eligibilityFacts: Array<{
    dimension: EligibilityDimension;
    state: "KNOWN" | "UNKNOWN";
    value: unknown;
    strength: EligibilityFact<unknown>["strength"];
  }>;
  supportSummary: string | null;
  evidence: CompactAnalysisEvidence[];
}

export interface CompactGrantAnalysisPayload {
  testProfile: Record<string, unknown>;
  candidates: CompactGrantAnalysisCandidate[];
}

export function buildCompactGrantAnalysisPayload(
  input: GrantAnalysisInput,
): CompactGrantAnalysisPayload {
  return {
    testProfile: compactProfile(input),
    candidates: input.candidates.map(compactCandidate),
  };
}

export function evidenceTextById(
  input: GrantAnalysisInput,
): Map<number, Map<string, string>> {
  return new Map(
    buildCompactGrantAnalysisPayload(input).candidates.map((candidate) => [
      candidate.announcementId,
      new Map(candidate.evidence.map(({ id, text }) => [id, text])),
    ]),
  );
}

function compactProfile(input: GrantAnalysisInput) {
  return compactRecord({
    userType: input.profile.user_type,
    region: input.profile.region,
    regionDistrict: input.profile.region_district,
    industry: input.profile.industry,
    startupYears: input.profile.startup_years,
    interests: input.profile.interests,
    birthYear: input.profile.birth_year,
    gender: input.profile.gender,
    degree: input.profile.degree,
    major: input.profile.major,
    employmentStatus: input.profile.employment_status,
    businessStatus: input.profile.business_status,
    annualRevenue: input.profile.annual_revenue,
    employeeCount: input.profile.employee_count,
    otherQualifications: input.profile.other_qualifications,
    youthPolicyInterests: input.profile.youth_policy_interests,
    businessItemDescription: input.businessItemDescription,
    neededSupport: input.neededSupport,
  });
}

function compactCandidate(
  candidate: GrantAnalysisInput["candidates"][number],
): CompactGrantAnalysisCandidate {
  const facts = buildAnnouncementEligibilityFacts(candidate);
  return {
    announcementId: candidate.id,
    metadata: {
      title: candidate.title,
      organization: candidate.agency,
      source: candidate.source_name,
      regionMetadata: compactRegions(candidate.region, candidate.regions),
      officialUrl: candidate.original_url,
    },
    existingRecommendationScore: candidate.score,
    categories: candidate.category_names,
    eligibilityFacts: (
      Object.entries(facts) as Array<
        [EligibilityDimension, EligibilityFact<unknown>]
      >
    ).flatMap(([dimension, fact]) =>
      fact.state === "NOT_APPLICABLE"
        ? []
        : [
            {
              dimension,
              state: fact.state,
              value: fact.value,
              strength: fact.strength,
            },
          ],
    ),
    supportSummary: supportSummary(candidate),
    evidence: candidateEvidence(candidate),
  };
}

function candidateEvidence(
  candidate: GrantAnalysisInput["candidates"][number],
) {
  const entries: Array<Omit<CompactAnalysisEvidence, "id">> = [];
  addEvidence(entries, "eligibility", label("지원대상", candidate.target));
  addEvidence(
    entries,
    "eligibility",
    label("학력조건", candidate.educationCondition),
  );
  addEvidence(
    entries,
    "eligibility",
    label("고용조건", candidate.employmentCondition),
  );
  addEvidence(
    entries,
    "eligibility",
    label("전공조건", candidate.majorCondition),
  );
  for (const text of eligibilitySections(candidate.detailContent)) {
    addEvidence(entries, "eligibility", text);
  }
  const support = supportSummary(candidate);
  if (support) addEvidence(entries, "support", `지원내용: ${support}`);

  return entries.slice(0, MAX_EVIDENCE_ITEMS).map((entry, index) => ({
    id: `E${index + 1}`,
    ...entry,
  }));
}

function supportSummary(
  candidate: GrantAnalysisInput["candidates"][number],
) {
  const direct = clean(candidate.supportType);
  if (direct) return direct.slice(0, MAX_SUPPORT_LENGTH);
  const section = firstSection(
    candidate.detailContent,
    /(?:^|\n)(?:지원내용|지원혜택|사업내용)\s*[:：]?\s*/g,
  );
  if (section) return section.slice(0, MAX_SUPPORT_LENGTH);
  const summary = clean(candidate.summary);
  return summary && /지원|자금|교육|컨설팅|입주|보증|융자/.test(summary)
    ? summary.slice(0, MAX_SUPPORT_LENGTH)
    : null;
}

function eligibilitySections(value: string | null) {
  if (!value) return [];
  const heading =
    /(?:^|\n)(신청대상|지원대상|신청자격|지원자격|참여대상|제외대상|지원조건|우대사항)\s*[:：]?\s*/g;
  const matches = [...value.matchAll(heading)];
  const sections = matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? value.length;
    const raw = value.slice(start, Math.min(end, start + MAX_EVIDENCE_LENGTH));
    const stop = raw.search(
      /\n(?:신청방법|제출서류|선정절차|평가방법|문의처|접수처|행사안내|유의사항|지원내용)\s*[:：]?/,
    );
    const content = clean(stop >= 0 ? raw.slice(0, stop) : raw);
    return content ? `${match[1]}: ${content}` : "";
  });
  return sections.filter(Boolean).slice(0, 5);
}

function firstSection(value: string | null, heading: RegExp) {
  if (!value) return null;
  const match = heading.exec(value);
  if (!match) return null;
  const raw = value.slice((match.index ?? 0) + match[0].length);
  const stop = raw.search(/\n[가-힣A-Za-z][^\n]{0,30}\s*[:：]?\s*\n/);
  return clean(stop >= 0 ? raw.slice(0, stop) : raw);
}

function addEvidence(
  entries: Array<Omit<CompactAnalysisEvidence, "id">>,
  kind: CompactAnalysisEvidence["kind"],
  value: string | null,
) {
  const text = clean(value)?.slice(0, MAX_EVIDENCE_LENGTH);
  if (!text) return;
  const key = dedupeKey(text);
  const duplicate = entries.findIndex(({ text: existing }) => {
    const existingKey = dedupeKey(existing);
    return existingKey === key || existingKey.includes(key) || key.includes(existingKey);
  });
  if (duplicate >= 0) {
    if (entries[duplicate].text.length < text.length) {
      entries[duplicate] = { kind, text };
    }
    return;
  }
  entries.push({ kind, text });
}

function compactRegions(region: string | null, regions: string[] | null) {
  return [region, ...(regions ?? [])].flatMap((value) => {
    const normalized = clean(value);
    return normalized ? [normalized] : [];
  }).filter((value, index, values) => values.indexOf(value) === index);
}

function label(name: string, value: string | null | undefined) {
  const text = clean(value);
  return text ? `${name}: ${text}` : null;
}

function clean(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function dedupeKey(value: string) {
  return value
    .replace(/^(?:지원대상|신청대상|신청자격|지원자격|참여대상|학력조건|고용조건|전공조건|지원내용)\s*[:：]\s*/, "")
    .replace(/[\s.,·ㆍ/()[\]{}:：-]+/g, "")
    .toLowerCase();
}

function compactRecord(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => {
      if (item === null || item === undefined || item === "") return false;
      return !Array.isArray(item) || item.length > 0;
    }),
  );
}
