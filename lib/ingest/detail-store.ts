import { supabaseAdmin } from "@/lib/supabase/server";
import {
  DetailFetchError,
  fetchAnnouncementDetail,
  sourcePayloadHash,
} from "./detail";
import type { NormalizedAnnouncement } from "./types";

const DETAIL_CONCURRENCY = 3;
const LOOKUP_CHUNK = 100;

interface ExistingDetailState {
  source_key: string;
  detail_source_hash: string | null;
  detail_fetched_at: string | null;
}

export interface DetailLookupResult {
  schemaReady: boolean;
  lookupReady: boolean;
  states: Map<string, ExistingDetailState>;
}

export interface DetailStoreResult {
  fetched: number;
  failed: number;
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
      .select("source_key,detail_source_hash,detail_fetched_at")
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
  if (!existing?.detail_fetched_at) return true;
  return existing.detail_source_hash !== sourcePayloadHash(announcement.raw);
}

export async function fetchAndStoreDetails(
  announcements: NormalizedAnnouncement[],
  sourceId: number
): Promise<DetailStoreResult> {
  let cursor = 0;
  let fetched = 0;
  let failed = 0;

  async function worker() {
    while (cursor < announcements.length) {
      const index = cursor++;
      const announcement = announcements[index];
      const attemptedAt = new Date().toISOString();

      try {
        const detail = await fetchAnnouncementDetail(announcement);
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
        const reason =
          error instanceof DetailFetchError ? error.publicReason : "원문 호출 실패";
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
  return { fetched, failed };
}

function isMissingDetailSchema(code: string | undefined, message: string) {
  return (
    code === "42703" ||
    code === "PGRST204" ||
    /detail_fetched_at|detail_content|detail_source_hash/i.test(message)
  );
}
