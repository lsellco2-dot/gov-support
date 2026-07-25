import { canonicalTitle } from "../cross-source-dedup";
import type {
  DuplicateAnalysis,
  DuplicateExample,
  ExistingAnnouncementForDedup,
  YouthCenterPolicy,
} from "./types";

const GENERIC_TITLE_TOKENS = new Set([
  "청년",
  "지원",
  "사업",
  "정책",
  "공고",
  "모집",
  "신청",
]);

export function analyzeYouthCenterDuplicates(
  policies: YouthCenterPolicy[],
  existing: ExistingAnnouncementForDedup[],
): DuplicateAnalysis {
  const exactTitleIndex = new Map<string, ExistingAnnouncementForDedup[]>();
  const tokenIndex = new Map<string, ExistingAnnouncementForDedup[]>();

  for (const row of existing) {
    append(exactTitleIndex, canonicalTitle(row.title), row);
    for (const token of titleTokens(row.title)) append(tokenIndex, token, row);
  }

  const strongYouthcenterIds = new Set<string>();
  const possibleYouthcenterIds = new Set<string>();
  const strongExamples: DuplicateExample[] = [];
  const possibleExamples: DuplicateExample[] = [];

  for (const policy of policies) {
    const canonical = canonicalTitle(policy.title);
    const exactCandidates = exactTitleIndex.get(canonical) ?? [];
    const strong = exactCandidates.find(
      (row) =>
        !isSameSourcePolicy(policy, row) &&
        isStrongDuplicate(policy, row),
    );
    if (strong) {
      strongYouthcenterIds.add(policy.sourceExternalId);
      if (strongExamples.length < 20) {
        strongExamples.push(
          example(policy, strong, "정규화 제목·기관·지역·신청기간 강한 일치"),
        );
      }
      continue;
    }

    const candidates = candidateRows(policy, tokenIndex, exactCandidates);
    let best:
      | { row: ExistingAnnouncementForDedup; score: number; reason: string }
      | null = null;
    for (const row of candidates) {
      if (isSameSourcePolicy(policy, row)) continue;
      const match = possibleDuplicateScore(policy, row);
      if (!match || (best && match.score <= best.score)) continue;
      best = { row, ...match };
    }
    if (!best) continue;

    possibleYouthcenterIds.add(policy.sourceExternalId);
    if (possibleExamples.length < 20) {
      possibleExamples.push(example(policy, best.row, best.reason));
    }
  }

  return {
    strongCount: strongYouthcenterIds.size,
    possibleCount: possibleYouthcenterIds.size,
    strongYouthcenterIds,
    possibleYouthcenterIds,
    strongExamples,
    possibleExamples,
  };
}

function isSameSourcePolicy(
  policy: YouthCenterPolicy,
  row: ExistingAnnouncementForDedup,
) {
  return (
    row.sourceCode === "youthcenter" &&
    row.sourceKey === policy.sourceExternalId
  );
}

function isStrongDuplicate(
  policy: YouthCenterPolicy,
  row: ExistingAnnouncementForDedup,
) {
  if (canonicalTitle(policy.title) !== canonicalTitle(row.title)) return false;
  if (!organizationMatches(policy, row.organization)) return false;
  if (!policy.region || !row.region || policy.region !== row.region) return false;
  return periodIsVerySimilar(policy, row);
}

function possibleDuplicateScore(
  policy: YouthCenterPolicy,
  row: ExistingAnnouncementForDedup,
) {
  const titleSimilarity = diceSimilarity(
    canonicalTitle(policy.title),
    canonicalTitle(row.title),
  );
  if (titleSimilarity < 0.72) return null;

  const supportSimilarity = diceSimilarity(
    canonicalText([
      policy.summary,
      policy.detailContent,
      policy.target,
      policy.supportType,
    ]),
    canonicalText([row.summary, row.target, row.supportType]),
  );
  const organization = organizationMatches(policy, row.organization);
  const region = Boolean(
    policy.region && row.region && policy.region === row.region,
  );
  const period = periodsOverlap(policy, row);
  const evidence = [
    supportSimilarity >= 0.25,
    organization,
    region,
    period,
  ].filter(Boolean).length;
  if (
    !(
      (titleSimilarity >= 0.76 && evidence >= 2) ||
      (titleSimilarity >= 0.88 && evidence >= 1)
    )
  ) {
    return null;
  }

  const score =
    titleSimilarity * 0.65 +
    supportSimilarity * 0.2 +
    (organization ? 0.06 : 0) +
    (region ? 0.04 : 0) +
    (period ? 0.05 : 0);
  const reasons = [
    `제목 유사도 ${titleSimilarity.toFixed(2)}`,
    supportSimilarity >= 0.25
      ? `지원내용 유사도 ${supportSimilarity.toFixed(2)}`
      : null,
    organization ? "기관 일부 일치" : null,
    region ? "지역 일치" : null,
    period ? "신청기간 중첩" : null,
  ].filter(Boolean);
  return { score, reason: reasons.join(", ") };
}

function candidateRows(
  policy: YouthCenterPolicy,
  index: Map<string, ExistingAnnouncementForDedup[]>,
  exact: ExistingAnnouncementForDedup[],
) {
  const rows = new Map<number, ExistingAnnouncementForDedup>();
  for (const row of exact) rows.set(row.id, row);
  for (const token of titleTokens(policy.title)) {
    for (const row of index.get(token) ?? []) rows.set(row.id, row);
  }
  return [...rows.values()];
}

function organizationMatches(
  policy: YouthCenterPolicy,
  existingOrganization: string | null,
) {
  const existing = canonicalText([existingOrganization]);
  if (!existing) return false;
  return [policy.organization, policy.managingOrganization]
    .map((value) => canonicalText([value]))
    .filter(Boolean)
    .some(
      (value) =>
        value === existing ||
        (Math.min(value.length, existing.length) >= 4 &&
          (value.includes(existing) || existing.includes(value))),
    );
}

function periodIsVerySimilar(
  policy: YouthCenterPolicy,
  row: ExistingAnnouncementForDedup,
) {
  const startComparable = dateDistance(policy.applyStart, row.applyStart);
  const endComparable = dateDistance(policy.applyEnd, row.applyEnd);
  if (endComparable !== null) {
    return endComparable <= 7 && (startComparable === null || startComparable <= 7);
  }
  return startComparable !== null && startComparable <= 7;
}

function periodsOverlap(
  policy: YouthCenterPolicy,
  row: ExistingAnnouncementForDedup,
) {
  if (periodIsVerySimilar(policy, row)) return true;
  const leftStart = policy.applyStart;
  const leftEnd = policy.applyEnd;
  const rightStart = row.applyStart;
  const rightEnd = row.applyEnd;
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return false;
  return leftStart <= rightEnd && rightStart <= leftEnd;
}

function dateDistance(left: string | null, right: string | null) {
  if (!left || !right) return null;
  const a = Date.parse(`${left}T00:00:00Z`);
  const b = Date.parse(`${right}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.abs(a - b) / 86_400_000;
}

function titleTokens(value: string) {
  const normalized = value
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]+/g, " ");
  const tokens = normalized
    .split(/\s+/)
    .filter(
      (token) =>
        token.length >= 2 &&
        !GENERIC_TITLE_TOKENS.has(token) &&
        !/^\d{4}$/.test(token),
    );
  if (tokens.length > 0) return Array.from(new Set(tokens));
  const canonical = canonicalTitle(value);
  return canonical.length >= 4 ? [canonical.slice(0, 4)] : [];
}

function canonicalText(values: Array<string | null>) {
  return values
    .filter(Boolean)
    .join(" ")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[^0-9a-z가-힣]/g, "");
}

function diceSimilarity(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const counts = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index++) {
    const pair = left.slice(index, index + 2);
    counts.set(pair, (counts.get(pair) ?? 0) + 1);
  }
  let intersection = 0;
  for (let index = 0; index < right.length - 1; index++) {
    const pair = right.slice(index, index + 2);
    const count = counts.get(pair) ?? 0;
    if (count > 0) {
      intersection++;
      counts.set(pair, count - 1);
    }
  }
  return (2 * intersection) / (left.length + right.length - 2);
}

function example(
  policy: YouthCenterPolicy,
  row: ExistingAnnouncementForDedup,
  reason: string,
): DuplicateExample {
  return {
    youthcenterId: policy.sourceExternalId,
    youthcenterTitle: policy.title,
    existingId: row.id,
    existingSourceId: row.sourceId,
    existingTitle: row.title,
    reason,
  };
}

function append(
  map: Map<string, ExistingAnnouncementForDedup[]>,
  key: string,
  value: ExistingAnnouncementForDedup,
) {
  if (!key) return;
  const rows = map.get(key);
  if (rows) rows.push(value);
  else map.set(key, [value]);
}
