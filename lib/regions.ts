export const INTEGRATED_GWANGJU_JEONNAM_REGION = "전남광주통합특별시";

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
