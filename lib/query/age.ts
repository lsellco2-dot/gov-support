export interface AgeSource {
  age_min?: number | null;
  age_max?: number | null;
  target?: string | null;
}

export function normalizeAge(value: unknown): number | undefined {
  if (value === "" || value === null || value === undefined) return undefined;
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const age = Number(value);
  return Number.isInteger(age) && age >= 0 && age <= 120 ? age : undefined;
}

// 청년이라는 명칭만으로 39세 상한을 추정하거나, 단체의 수혜자 나이를 신청자 나이로 쓰지 않는다.
export function ageEligibility(row: AgeSource, age: number): "match" | "conflict" | "unknown" {
  const target = row.target ?? "";
  if (/단체|법인|동아리|동호회|기관|자녀|부모|가구원/.test(target)) return "unknown";
  let min = normalizeAge(row.age_min);
  let max = normalizeAge(row.age_max);
  const ranges = [...target.matchAll(/(?:만\s*)?(\d{1,3})\s*세?\s*(?:이상\s*[~～∼-]?\s*|[~～∼-]\s*)(?:만\s*)?(\d{1,3})\s*세(?:\s*(이하|미만))?/g)];
  // 원천의 18~0세 같은 미입력 상한과 복수 범위를 '18세 이상 무제한'으로 바꾸지 않는다.
  if (ranges.length > 1 || ranges.some(range => Number(range[1]) > Number(range[2]))) return "unknown";
  if (ranges.length === 1 && (min !== undefined || max !== undefined) && !/또는|혹은|예외|우대|가점|제외|이외|다만/.test(target)) {
    const textMin = normalizeAge(ranges[0][1]);
    const textMax = normalizeAge(ranges[0][2]);
    if (textMin !== undefined) min = Math.max(min ?? 0, textMin);
    if (textMax !== undefined) max = Math.min(max ?? 120, textMax - (ranges[0][3] === "미만" ? 1 : 0));
  }
  if (min === undefined && max === undefined) {
    if (/연령\s*(?:제한\s*없음|무관)|나이\s*(?:제한\s*없음|무관)/.test(target)) return "match";
    // 복수 대상/예외/우대 조건은 단일 연령 제한으로 단정하지 않는다.
    if (/또는|혹은|예외|우대|가점|제외|이외|다만/.test(target)) return "unknown";
    if (ranges.length === 1) {
      min = normalizeAge(ranges[0][1]);
      max = normalizeAge(ranges[0][2]);
      if (max !== undefined && ranges[0][3] === "미만") max--;
    } else {
      const bounds = [...target.matchAll(/(?:만\s*)?(\d{1,3})\s*세\s*(이상|이하|미만|초과)/g)];
      if (bounds.length !== 1) return "unknown";
      const bound = normalizeAge(bounds[0][1]);
      if (bound === undefined) return "unknown";
      const operator = bounds[0][2];
      if (operator === "이상" || operator === "초과") min = bound + (operator === "초과" ? 1 : 0);
      else max = bound - (operator === "미만" ? 1 : 0);
    }
  }
  if (min !== undefined && max !== undefined && min > max) return "unknown";
  if ((min !== undefined && age < min) || (max !== undefined && age > max)) return "conflict";
  return min !== undefined || max !== undefined ? "match" : "unknown";
}

export function matchesAge(row: AgeSource, age: number, knownOnly: boolean) {
  const result = ageEligibility(row, age);
  return result === "match" || (!knownOnly && result === "unknown");
}
