export const ELIGIBILITY_STATUSES = [
  "MATCH",
  "MISMATCH",
  "UNKNOWN",
  "NOT_APPLICABLE",
] as const;

export const ELIGIBILITY_DIMENSIONS = [
  "gender",
  "age",
  "education",
  "major",
  "startupStatus",
  "startupYears",
  "businessType",
  "employmentStatus",
  "regionProvince",
  "regionDistrict",
  "income",
  "otherRequirements",
] as const;

export type EligibilityStatus = (typeof ELIGIBILITY_STATUSES)[number];
export type EligibilityDimension = (typeof ELIGIBILITY_DIMENSIONS)[number];
export type EligibilityFactState = "KNOWN" | "UNKNOWN" | "NOT_APPLICABLE";
export type EligibilityStrength = "REQUIRED" | "PREFERRED" | "UNKNOWN";

export interface EligibilityFact<T> {
  state: EligibilityFactState;
  value: T | null;
  source: "profile" | "structured" | "eligibility_text" | "none";
  strength: EligibilityStrength;
}

export interface EligibilityFacts {
  gender: EligibilityFact<string>;
  age: EligibilityFact<number | { min: number | null; max: number | null }>;
  education: EligibilityFact<string>;
  major: EligibilityFact<string>;
  startupStatus: EligibilityFact<
    "PRE_STARTUP" | "EXISTING" | "PRE_STARTUP_ONLY" | "EXISTING_ONLY" | "BOTH"
  >;
  startupYears: EligibilityFact<
    string | { min: number | null; max: number | null }
  >;
  businessType: EligibilityFact<string>;
  employmentStatus: EligibilityFact<string>;
  regionProvince: EligibilityFact<string[]>;
  regionDistrict: EligibilityFact<string[]>;
  income: EligibilityFact<number | { min: number | null; max: number | null }>;
  otherRequirements: EligibilityFact<string[]>;
}

export interface EligibilityComparison {
  dimension: EligibilityDimension;
  status: EligibilityStatus;
  userValue: unknown;
  requirementValue: unknown;
  source: EligibilityFact<unknown>["source"];
  strength: EligibilityStrength;
  label: string;
}

export interface EligibilityValidation {
  user: EligibilityFacts;
  announcement: EligibilityFacts;
  comparisons: EligibilityComparison[];
  mismatch: EligibilityComparison[];
  unknown: EligibilityComparison[];
  matched: EligibilityComparison[];
  preferred: EligibilityComparison[];
}
