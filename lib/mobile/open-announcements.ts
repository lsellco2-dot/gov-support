import {
  listAnnouncements,
  type AnnouncementListResult,
  type AnnouncementRow,
  type ListParams,
} from "@/lib/query/announcements";
import { announcementSourceCode } from "./announcement-source";
import {
  isNationwideUserRegion,
  recommendationRegionLabel,
} from "./recommendations";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export interface OpenAnnouncementsParams {
  page: number;
  limit: number;
  sort: OpenAnnouncementsSort;
  categoryIds?: number[];
  userRegion?: string;
  includeNationwide?: boolean;
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
  const categoryIds = parseCategoryIds(searchParams.get("categories"));
  if (categoryIds === null) {
    return invalid("INVALID_CATEGORIES", "categories must be comma-separated ids from 1 to 9.");
  }
  const userRegion = searchParams.get("user_region")?.trim().toLowerCase();
  if (
    userRegion &&
    !isNationwideUserRegion(userRegion) &&
    recommendationRegionLabel(userRegion) === null
  ) {
    return invalid("INVALID_USER_REGION", "user_region is not supported.");
  }
  const includeNationwide = parseBoolean(searchParams.get("include_nationwide"));
  if (includeNationwide === null) {
    return invalid("INVALID_NATIONWIDE_FILTER", "include_nationwide must be true or false.");
  }
  return {
    ok: true,
    value: {
      page,
      limit: Math.min(limit, MAX_LIMIT),
      sort,
      ...(categoryIds.length > 0 ? { categoryIds } : {}),
      ...(userRegion ? { userRegion, includeNationwide } : {}),
    },
  };
}

export async function queryOpenAnnouncements(params: OpenAnnouncementsParams) {
  return listAnnouncements(buildOpenAnnouncementsListParams(params));
}

export function buildOpenAnnouncementsListParams(
  params: OpenAnnouncementsParams,
): ListParams {
  const regionLabel = params.userRegion && !isNationwideUserRegion(params.userRegion)
    ? recommendationRegionLabel(params.userRegion)
    : null;
  return {
    status: "open",
    sort: params.sort,
    page: params.page,
    size: params.limit,
    ...(params.categoryIds?.length ? { categoryIds: params.categoryIds } : {}),
    ...(regionLabel
      ? {
          recommendationRegion: {
            label: regionLabel,
            includeNationwide: params.includeNationwide !== false,
          },
        }
      : {}),
  };
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
    source: announcementSourceCode(item.source_id),
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

function parseCategoryIds(value: string | null) {
  if (value === null || value === "") return [];
  if (!/^\d(?:,\d)*$/.test(value)) return null;
  const ids = [...new Set(value.split(",").map(Number))].sort((a, b) => a - b);
  return ids.every((id) => Number.isInteger(id) && id >= 1 && id <= 9) ? ids : null;
}

function parseBoolean(value: string | null) {
  if (value === null || value === "") return true;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function invalid(code: string, message: string) {
  return { ok: false as const, error: { code, message } };
}
