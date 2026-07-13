import { supabaseAdmin } from "@/lib/supabase/server";
import {
  DetailFetchError,
  fetchAnnouncementDetail,
  sourcePayloadHash,
} from "./detail";
import type { NormalizedAnnouncement } from "./types";
import { inferBizinfoRegion } from "./adapters/bizinfo-region";

const DETAIL_CONCURRENCY = 3;
const LOOKUP_CHUNK = 100;
const EMPTY_SHELL_ERROR = "empty_shell_200";
const FINAL_EMPTY_SHELL_ATTEMPT = 2;
const EMPTY_SHELL_RETRY_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const FINAL_EMPTY_SHELL_ERROR = `${EMPTY_SHELL_ERROR}:${FINAL_EMPTY_SHELL_ATTEMPT}`;

interface ExistingDetailState {
  source_key: string;
  detail_source_hash: string | null;
  detail_fetched_at: string | null;
  detail_fetch_status: string | null;
  detail_fetch_error: string | null;
  detail_fetch_attempted_at: string | null;
}

export interface DetailLookupResult {
  schemaReady: boolean;
  lookupReady: boolean;
  states: Map<string, ExistingDetailState>;
}

export interface DetailStoreResult {
  fetched: number;
  failed: number;
  emptyShell: number;
  emptyShellFinalized: number;
}

export async function loadExistingDetailStates(
  sourceId: number,
  sourceKeys: string[]
): Promise<DetailLookupResult> {
  if (sourceKeys.length === 0) {
    return { schemaReady: true, lookupReady: true, states: new Map() };
  }

  const states = new Map<string, ExistingDetailState>();
  for (let index = 0; index < sourceKeys.length; index += LOOKUP_CHUNK) {
    const { data, error } = await supabaseAdmin
      .from("announcements")
      .select(
        "source_key,detail_source_hash,detail_fetched_at,detail_fetch_status,detail_fetch_error,detail_fetch_attempted_at"
      )
      .eq("source_id", sourceId)
      .in("source_key", sourceKeys.slice(index, index + LOOKUP_CHUNK));

    if (error) {
      if (isMissingDetailSchema(error.code, error.message)) {
        return { schemaReady: false, lookupReady: false, states: new Map() };
      }
      console.error("[detail] 기존 상세 상태 조회 실패:", error.message);
      return { schemaReady: true, lookupReady: false, states: new Map() };
    }

    for (const row of (data ?? []) as ExistingDetailState[]) {
      states.set(row.source_key, row);
    }
  }
  return { schemaReady: true, lookupReady: true, states };
}

export function needsDetailFetch(
  announcement: NormalizedAnnouncement,
  existing?: ExistingDetailState
) {
  if (!announcement.detailUrl) return false;
  if (existing?.detail_fetched_at) {
    return existing.detail_source_hash !== sourcePayloadHash(announcement.raw);
  }
  if (existing?.detail_fetch_error === FINAL_EMPTY_SHELL_ERROR) {
    return (
      isOpenOrOngoing(announcement.applyEnd) &&
      retryIntervalElapsed(existing.detail_fetch_attempted_at)
    );
  }
  return true;
}

function isOpenOrOngoing(applyEnd: string | null) {
  return applyEnd === null || applyEnd >= todayKst();
}

function retryIntervalElapsed(attemptedAt: string | null) {
  if (!attemptedAt) return true;
  const attempted = Date.parse(attemptedAt);
  return !Number.isFinite(attempted) || Date.now() - attempted >= EMPTY_SHELL_RETRY_INTERVAL_MS;
}

function todayKst() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function fetchAndStoreDetails(
  announcements: NormalizedAnnouncement[],
  sourceId: number
): Promise<DetailStoreResult> {
  let cursor = 0;
  let fetched = 0;
  let failed = 0;
  let emptyShell = 0;
  let emptyShellFinalized = 0;

  async function worker() {
    while (cursor < announcements.length) {
      const index = cursor++;
      const announcement = announcements[index];
      const attemptedAt = new Date().toISOString();

      try {
        const detail = await fetchAnnouncementDetail(announcement);
        const region =
          announcement.sourceCode === "bizinfo"
            ? inferBizinfoRegion({
                title: announcement.title,
                target: announcement.target,
                summary: announcement.summary,
                detailContent: detail.detailContent,
              }).region
            : undefined;
        const { error } = await supabaseAdmin
          .from("announcements")
          .update({
            detail_content: detail.detailContent,
            apply_method: detail.applyMethod,
            documents: detail.documents,
            contact: detail.contact,
            attachments: detail.attachments,
            detail_content_hash: detail.contentHash,
            detail_source_hash: sourcePayloadHash(announcement.raw),
            detail_fetched_at: attemptedAt,
            detail_fetch_attempted_at: attemptedAt,
            detail_fetch_status: "success",
            detail_fetch_error: null,
            ...(region ? { region } : {}),
          })
          .eq("source_id", sourceId)
          .eq("source_key", announcement.sourceKey);

        if (error) {
          failed++;
          console.error(`[${announcement.sourceCode}] 상세 저장 실패:`, error.message);
        } else {
          fetched++;
        }
      } catch (error) {
        failed++;
        let reason =
          error instanceof DetailFetchError ? error.publicReason : "원문 호출 실패";
        if (reason === EMPTY_SHELL_ERROR) {
          emptyShell++;
          const previousAttempt = await loadEmptyShellAttempt(
            sourceId,
            announcement.sourceKey
          );
          const nextAttempt = Math.min(
            FINAL_EMPTY_SHELL_ATTEMPT,
            previousAttempt + 1
          );
          reason = `${EMPTY_SHELL_ERROR}:${nextAttempt}`;
          if (nextAttempt >= FINAL_EMPTY_SHELL_ATTEMPT) emptyShellFinalized++;
        }
        console.error(
          `[${announcement.sourceCode}] 상세 수집 실패:`,
          error instanceof Error ? error.message : "unknown error"
        );
        const { error: statusError } = await supabaseAdmin
          .from("announcements")
          .update({
            detail_fetch_attempted_at: attemptedAt,
            detail_fetch_status: "failed",
            detail_fetch_error: reason.slice(0, 200),
          })
          .eq("source_id", sourceId)
          .eq("source_key", announcement.sourceKey);
        if (statusError) {
          console.error(
            `[${announcement.sourceCode}] 상세 실패 상태 저장 오류:`,
            statusError.message
          );
        }
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(DETAIL_CONCURRENCY, announcements.length) },
      () => worker()
    )
  );
  return { fetched, failed, emptyShell, emptyShellFinalized };
}

async function loadEmptyShellAttempt(sourceId: number, sourceKey: string) {
  const { data, error } = await supabaseAdmin
    .from("announcements")
    .select("detail_fetch_error")
    .eq("source_id", sourceId)
    .eq("source_key", sourceKey)
    .maybeSingle();

  if (error) {
    console.error("[detail] 빈 셸 이전 시도 조회 실패:", error.message);
    return 0;
  }

  const previous = String(data?.detail_fetch_error ?? "");
  const recordedAttempt = Number(previous.match(/^empty_shell_200:(\d+)$/)?.[1] ?? 0);
  if (Number.isInteger(recordedAttempt) && recordedAttempt > 0) {
    return Math.min(FINAL_EMPTY_SHELL_ATTEMPT, recordedAttempt);
  }
  // 이전 버전의 "본문 없음" 기록은 이미 한 번 호출한 빈 셸 공고로 본다.
  return previous === "본문 없음" ? 1 : 0;
}

function isMissingDetailSchema(code: string | undefined, message: string) {
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /detail_fetched_at|detail_content|detail_source_hash/i.test(message)
  );
}
