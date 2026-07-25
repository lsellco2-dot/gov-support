export const INTEGRATED_GWANGJU_JEONNAM_REGION = "전남광주통합특별시";
export type AnnouncementRegionMatch = "match" | "conflict" | "unknown";

const INTEGRATED_REGION_ALIASES = [
  INTEGRATED_GWANGJU_JEONNAM_REGION,
  "전남광주",
  "광주전남통합특별시",
] as const;

const REGION_COMPATIBILITY: Record<string, string[]> = {
  광주: ["광주", INTEGRATED_GWANGJU_JEONNAM_REGION],
  전남: ["전남", INTEGRATED_GWANGJU_JEONNAM_REGION],
  [INTEGRATED_GWANGJU_JEONNAM_REGION]: [
    INTEGRATED_GWANGJU_JEONNAM_REGION,
    "광주",
    "전남",
  ],
};

export function normalizeIntegratedRegionName(value: string | null | undefined) {
  const normalized = value?.normalize("NFKC").replace(/\s+/g, "").trim();
  if (!normalized) return null;
  return INTEGRATED_REGION_ALIASES.some((alias) => normalized.includes(alias))
    ? INTEGRATED_GWANGJU_JEONNAM_REGION
    : null;
}

export function compatibleRegionLabels(region: string) {
  const normalized =
    normalizeIntegratedRegionName(region) ?? region.normalize("NFKC").trim();
  if (!normalized) return [];
  return [...(REGION_COMPATIBILITY[normalized] ?? [normalized])];
}

export function matchesCompatibleRegion(
  userRegion: string,
  announcementRegion: string | null,
) {
  if (!announcementRegion?.trim()) return false;
  const candidate =
    normalizeIntegratedRegionName(announcementRegion) ??
    announcementRegion.normalize("NFKC").trim();
  return compatibleRegionLabels(userRegion).some(
    (label) => candidate === label || candidate.includes(label),
  );
}

export function announcementRegionValues(
  region: string | null | undefined,
  regions: readonly string[] | null | undefined,
) {
  const normalizedRegions = uniqueRegionValues(regions ?? []);
  if (normalizedRegions.length > 0) return normalizedRegions;

  const fallback = normalizeRegionValue(region);
  return fallback ? [fallback] : [];
}

export function isNationwideAnnouncementRegion(
  region: string | null | undefined,
  regions: readonly string[] | null | undefined,
) {
  return announcementRegionValues(region, regions).some(isNationwideValue);
}

export function matchAnnouncementRegion(
  userRegion: string,
  region: string | null | undefined,
  regions: readonly string[] | null | undefined,
): AnnouncementRegionMatch {
  if (isNationwideValue(userRegion)) return "match";

  const candidates = announcementRegionValues(region, regions);
  if (candidates.length === 0) return "unknown";
  if (candidates.some(isNationwideValue)) return "match";

  return candidates.some((candidate) =>
    matchesCompatibleRegion(userRegion, candidate),
  )
    ? "match"
    : "conflict";
}

export function announcementRegionPostgrestFilter(
  userRegion: string,
  options: {
    includeNationwide: boolean;
    includeUnknown: boolean;
  },
) {
  const regionalLabels = compatibleRegionLabels(userRegion);
  const acceptedLabels = uniqueRegionValues([
    ...regionalLabels,
    ...(options.includeNationwide ? ["전국"] : []),
  ]);
  if (acceptedLabels.length === 0) return null;

  const arrayLiteral = `{${acceptedLabels.map(postgrestQuoted).join(",")}}`;
  const scalarList = `(${acceptedLabels.map(postgrestQuoted).join(",")})`;
  const arrayMatch = options.includeNationwide
    ? `regions.ov.${arrayLiteral}`
    : `and(regions.ov.${arrayLiteral},regions.not.ov.{"전국"})`;
  const clauses = [
    arrayMatch,
    `and(regions.is.null,region.in.${scalarList})`,
    `and(regions.eq.{},region.in.${scalarList})`,
  ];

  if (options.includeUnknown) {
    clauses.push(
      "and(regions.is.null,region.is.null)",
      "and(regions.eq.{},region.is.null)",
    );
  }
  return clauses.join(",");
}

function uniqueRegionValues(values: readonly (string | null | undefined)[]) {
  return [
    ...new Set(
      values
        .map(normalizeRegionValue)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function normalizeRegionValue(value: string | null | undefined) {
  const normalized =
    normalizeIntegratedRegionName(value) ?? value?.normalize("NFKC").trim();
  if (!normalized || normalized === "미확인" || normalized === "지역 확인 필요") {
    return null;
  }
  return normalized;
}

function isNationwideValue(value: string) {
  const normalized = value.normalize("NFKC").trim().toLowerCase();
  return normalized === "전국" || normalized === "nationwide";
}

function postgrestQuoted(value: string) {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
