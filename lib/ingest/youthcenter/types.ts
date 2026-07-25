export type YouthCenterRawRecord = Record<string, string | string[]>;

export type YouthPolicyDomain =
  | "employment_startup"
  | "housing"
  | "education_training"
  | "finance_welfare_culture"
  | "participation_infrastructure"
  | "unknown";

export type YouthPolicyStatus =
  | "upcoming"
  | "open"
  | "closed"
  | "ongoing"
  | "unknown";

export type YouthSourceStatus =
  | "open"
  | "upcoming"
  | "always"
  | "closed"
  | "unknown";

export type YouthPolicyDateMode =
  | "fixed"
  | "ongoing"
  | "until_budget_exhausted"
  | "undecided"
  | "unknown";

export interface YouthCenterPolicy {
  sourceExternalId: string;
  title: string;
  summary: string | null;
  detailContent: string | null;
  organization: string | null;
  managingOrganization: string | null;
  region: string | null;
  regions: string[];
  regionResolution: "nationwide" | "single" | "multiple" | "unknown";
  target: string | null;
  supportType: string | null;
  applyStart: string | null;
  applyEnd: string | null;
  dateMode: YouthPolicyDateMode;
  status: YouthPolicyStatus;
  sourceStatus: YouthSourceStatus;
  originalUrl: string | null;
  applicationUrl: string | null;
  ageMin: number | null;
  ageMax: number | null;
  incomeCondition: string | null;
  educationCondition: string | null;
  employmentCondition: string | null;
  majorCondition: string | null;
  specialtyCondition: string | null;
  policyDomain: YouthPolicyDomain;
  sourceUpdatedAt: string | null;
  included: boolean;
  inclusionReason: string;
  raw: YouthCenterRawRecord;
}

export interface YouthCenterFetchResult {
  apiVariant: "legacy" | "current";
  records: YouthCenterRawRecord[];
  pagesFetched: number;
  reportedTotal: number | null;
  requestCount: number;
}

export interface ExistingAnnouncementForDedup {
  id: number;
  sourceId: number;
  sourceCode: string | null;
  sourceKey: string;
  title: string;
  organization: string | null;
  region: string | null;
  target: string | null;
  supportType: string | null;
  summary: string | null;
  applyStart: string | null;
  applyEnd: string | null;
}

export interface DuplicateExample {
  youthcenterId: string;
  youthcenterTitle: string;
  existingId: number;
  existingSourceId: number;
  existingTitle: string;
  reason: string;
}

export interface DuplicateAnalysis {
  strongCount: number;
  possibleCount: number;
  strongYouthcenterIds: Set<string>;
  possibleYouthcenterIds: Set<string>;
  strongExamples: DuplicateExample[];
  possibleExamples: DuplicateExample[];
}
