import {
  listAnnouncements,
  type AnnouncementListResult,
  type AnnouncementRow,
} from "@/lib/query/announcements";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface OpenAnnouncementsParams {
  page: number;
  limit: number;
  sort: OpenAnnouncementsSort;
}

export type OpenAnnouncementsSort = "latest" | "deadline";

type ParseResult =
  | { ok: true; value: OpenAnnouncementsParams }
  | { ok: false; error: { code: string; message: string } };

export function parseOpenAnnouncementsParams(searchParams: URLSearchParams): ParseResult {
  const page = parsePositiveInteger(searchParams.get("page"), 1, false);
  if (page === null) {
    return invalid("INVALID_PAGE", "page must be a positive integer.");
  }
  const limit = parsePositiveInteger(searchParams.get("limit"), DEFAULT_LIMIT, true);
  if (limit === null) {
    return invalid("INVALID_LIMIT", "limit must be a positive integer.");
  }
  const sort = searchParams.get("sort") === "deadline" ? "deadline" : "latest";
  return { ok: true, value: { page, limit: Math.min(limit, MAX_LIMIT), sort } };
}

export async function queryOpenAnnouncements(params: OpenAnnouncementsParams) {
  return listAnnouncements({
    status: "open",
    sort: params.sort,
    page: params.page,
    size: params.limit,
  });
}

export function buildOpenAnnouncementsPayload(
  result: AnnouncementListResult,
  origin: string,
) {
  const totalPages = Math.max(1, Math.ceil(result.total / result.size));
  return {
    data: result.items.map((item) => toPublicItem(item, origin)),
    pagination: {
      page: result.page,
      limit: result.size,
      total: result.total,
      total_pages: totalPages,
      has_more: result.page < totalPages,
    },
  };
}

function toPublicItem(item: AnnouncementRow, origin: string) {
  return {
    id: item.id,
    title: item.title,
    agency: item.organization,
    category_ids: item.category_ids,
    region: item.region,
    target: item.target,
    support_type: item.support_type,
    status: "open" as const,
    apply_start: item.apply_start,
    apply_end: item.apply_end,
    created_at: item.created_at,
    detail_url: new URL(`/app/announcements/${item.id}`, origin).toString(),
    original_url: item.detail_url,
  };
}

function parsePositiveInteger(value: string | null, fallback: number, allowClamp: boolean) {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) return null;
  if (!allowClamp && parsed > Number.MAX_SAFE_INTEGER) return null;
  return parsed;
}

function invalid(code: string, message: string) {
  return { ok: false as const, error: { code, message } };
}
