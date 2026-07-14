export type AnnouncementSourceCode =
  | "bizinfo"
  | "kstartup"
  | "mss"
  | "mois"
  | "msit";

const SOURCE_CODE_BY_ID: Record<number, AnnouncementSourceCode> = {
  1: "bizinfo",
  2: "kstartup",
  3: "mss",
  4: "mois",
  5: "msit",
};

const SOURCE_LABELS: Record<AnnouncementSourceCode, string> = {
  bizinfo: "기업마당",
  kstartup: "K-Startup",
  mss: "중소벤처기업부",
  mois: "행정안전부",
  msit: "과학기술정보통신부",
};

export function announcementSourceCode(sourceId: number) {
  return SOURCE_CODE_BY_ID[sourceId] ?? null;
}

export function announcementSourceLabel(source: string | null | undefined) {
  return SOURCE_LABELS[source as AnnouncementSourceCode] ?? "출처 정보 없음";
}
