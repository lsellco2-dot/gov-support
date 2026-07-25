import { mapYouthCenterPolicy } from "./mapper";
import type {
  YouthCenterPolicy,
  YouthCenterRawRecord,
} from "./types";

export interface PreparedYouthCenterPolicies {
  mapped: YouthCenterPolicy[];
  unique: YouthCenterPolicy[];
  parseFailureCount: number;
  dateParseFailureCount: number;
  internalDuplicateCount: number;
  fieldMissing: Map<string, number>;
}

export function prepareYouthCenterPolicies(
  records: YouthCenterRawRecord[],
  now = new Date(),
): PreparedYouthCenterPolicies {
  const mapped: YouthCenterPolicy[] = [];
  const fieldMissing = new Map<string, number>();
  let parseFailureCount = 0;
  let dateParseFailureCount = 0;

  for (const raw of records) {
    const result = mapYouthCenterPolicy(raw, now);
    if (!result.policy) {
      parseFailureCount++;
      continue;
    }

    mapped.push(result.policy);
    if (result.dateParseFailed) dateParseFailureCount++;
    for (const field of result.missingFields) {
      fieldMissing.set(field, (fieldMissing.get(field) ?? 0) + 1);
    }
  }

  const deduplicated = removeInternalDuplicates(mapped);
  return {
    mapped,
    unique: deduplicated.unique,
    parseFailureCount,
    dateParseFailureCount,
    internalDuplicateCount: deduplicated.duplicateCount,
    fieldMissing,
  };
}

export function removeInternalDuplicates(policies: YouthCenterPolicy[]) {
  const byId = new Map<string, YouthCenterPolicy>();
  let duplicateCount = 0;

  for (const policy of policies) {
    const existing = byId.get(policy.sourceExternalId);
    if (!existing) {
      byId.set(policy.sourceExternalId, policy);
      continue;
    }

    duplicateCount++;
    if (
      policy.sourceUpdatedAt &&
      (!existing.sourceUpdatedAt ||
        policy.sourceUpdatedAt > existing.sourceUpdatedAt)
    ) {
      byId.set(policy.sourceExternalId, policy);
    }
  }

  return { unique: [...byId.values()], duplicateCount };
}
