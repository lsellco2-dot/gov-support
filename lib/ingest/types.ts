import type { FetchedAnnouncementDetail } from "./detail";

export type SourceCode = "bizinfo" | "kstartup" | "mss" | "mois" | "msit"
  | "bokji-central" | "bokji-local" | "enara" | "culture";

export const SOURCE_ID: Partial<Record<SourceCode, number>> & { bizinfo: number; kstartup: number } = {
  bizinfo: 1,
  kstartup: 2,
  mss: 3,
  mois: 4,
  msit: 5,
};

export interface NormalizedAttachment {
  label: string;
  url: string;
}

export interface NormalizedAnnouncement {
  sourceCode: SourceCode;
  sourceKey: string;
  title: string;
  organization: string | null;
  region: string | null;
  target: string | null;
  supportType: string | null;
  summary: string | null;
  applyStart: string | null; // 'YYYY-MM-DD'
  applyEnd: string | null;   // null = 상시/미상
  detailUrl: string | null;
  attachments?: NormalizedAttachment[];
  detail?: FetchedAnnouncementDetail;
  raw: unknown;
}

export interface SourceAdapter {
  sourceCode: SourceCode;
  /** New sources are opt-in until API permission and public display have been checked. */
  enableEnv?: string;
  keyEnv?: string;
  name?: string;
  skipHtmlDetails?: boolean;
  /** Excluded from the shared HTTP cron; explicitly run via the server CLI. */
  requiresLongRunningJob?: boolean;
  fetchDetail?: (announcement: NormalizedAnnouncement) => Promise<FetchedAnnouncementDetail>;
  /** 페이지 단위로 원본 아이템 배열을 yield. 전량 수집. */
  fetchPages(opts: { serviceKey: string }): AsyncGenerator<unknown[]>;
  /** 매핑 불가/대상 외 항목은 null 반환 → 스킵 */
  normalize(raw: unknown): NormalizedAnnouncement | null;
}
