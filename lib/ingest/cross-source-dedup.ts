export interface DuplicateCandidate {
  title: string;
  applyEnd: string | null;
}

export interface DuplicateIndex {
  exact: Map<string, DuplicateCandidate[]>;
  byNumberSignature: Map<string, DuplicateCandidate[]>;
}

const MIN_CANONICAL_LENGTH = 10;
const FUZZY_THRESHOLD = 0.86;

export function createDuplicateIndex(rows: DuplicateCandidate[]): DuplicateIndex {
  const exact = new Map<string, DuplicateCandidate[]>();
  const byNumberSignature = new Map<string, DuplicateCandidate[]>();

  for (const row of rows) {
    const canonical = canonicalTitle(row.title);
    if (canonical.length < MIN_CANONICAL_LENGTH) continue;
    append(exact, canonical, row);
    append(byNumberSignature, numberSignature(canonical), row);
  }

  return { exact, byNumberSignature };
}

export function isPreferredSourceDuplicate(
  candidate: DuplicateCandidate,
  index: DuplicateIndex
) {
  const canonical = canonicalTitle(candidate.title);
  if (canonical.length < MIN_CANONICAL_LENGTH) return false;
  if (index.exact.has(canonical)) return true;

  const references = index.byNumberSignature.get(numberSignature(canonical)) ?? [];
  return references.some((reference) => {
    if (
      candidate.applyEnd &&
      reference.applyEnd &&
      candidate.applyEnd !== reference.applyEnd
    ) {
      return false;
    }
    return diceSimilarity(canonical, canonicalTitle(reference.title)) >= FUZZY_THRESHOLD;
  });
}

export function canonicalTitle(title: string) {
  return title
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/(\d{4})년도/g, "$1년")
    .replace(/[^0-9a-z가-힣ㄱ-ㅎㅏ-ㅣ]/g, "");
}

function numberSignature(value: string) {
  return value.match(/\d+/g)?.join("|") ?? "";
}

function append(
  map: Map<string, DuplicateCandidate[]>,
  key: string,
  value: DuplicateCandidate
) {
  const rows = map.get(key);
  if (rows) rows.push(value);
  else map.set(key, [value]);
}

function diceSimilarity(left: string, right: string) {
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
