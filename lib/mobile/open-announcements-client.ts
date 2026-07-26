import type { OpenAnnouncement } from "./recommendations";
import type { OpenAnnouncementsSort } from "./open-announcements";

const VERSION_CACHE_MS = 30_000;
let recentVersion: { value: string; checkedAt: number } | null = null;

export interface OpenAnnouncementsPage {
  data: OpenAnnouncement[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_more: boolean;
  };
}

export interface OpenAnnouncementsCandidateFilter {
  categoryIds: number[];
  userRegion: string;
  includeNationwide: boolean;
}

export async function fetchOpenAnnouncements(
  page: number,
  sort: OpenAnnouncementsSort = "latest",
  limit = 50,
  filter?: OpenAnnouncementsCandidateFilter,
  signal?: AbortSignal,
): Promise<OpenAnnouncementsPage> {
  const query = buildOpenAnnouncementsQuery(page, sort, limit, filter);
  const response = await fetch(`/api/mobile/open-announcements?${query}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !isOpenAnnouncementsPage(payload)) {
    throw new Error("OPEN_ANNOUNCEMENTS_UNAVAILABLE");
  }
  return payload;
}

export async function fetchOpenAnnouncementsVersion(
  signal?: AbortSignal,
): Promise<string> {
  const now = Date.now();
  if (recentVersion && now - recentVersion.checkedAt < VERSION_CACHE_MS) {
    return recentVersion.value;
  }
  const response = await fetch("/api/mobile/open-announcements/version", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
  const payload = await response.json().catch(() => null);
  if (
    !response.ok ||
    !isRecord(payload) ||
    typeof payload.version !== "string" ||
    !payload.version
  ) {
    throw new Error("OPEN_ANNOUNCEMENTS_VERSION_UNAVAILABLE");
  }
  recentVersion = { value: payload.version, checkedAt: now };
  return payload.version;
}

export function buildOpenAnnouncementsQuery(
  page: number,
  sort: OpenAnnouncementsSort,
  limit: number,
  filter?: OpenAnnouncementsCandidateFilter,
) {
  const query = new URLSearchParams({ page: String(page), limit: String(limit), sort });
  if (filter) {
    query.set("categories", [...new Set(filter.categoryIds)].sort((a, b) => a - b).join(","));
    query.set("user_region", filter.userRegion);
    query.set("include_nationwide", String(filter.includeNationwide));
  }
  return query;
}

function isOpenAnnouncementsPage(value: unknown): value is OpenAnnouncementsPage {
  if (!isRecord(value) || !Array.isArray(value.data) || !isRecord(value.pagination)) return false;
  return value.data.every(isOpenAnnouncement) &&
    Number.isInteger(value.pagination.page) &&
    Number.isInteger(value.pagination.limit) &&
    Number.isInteger(value.pagination.total) &&
    Number.isInteger(value.pagination.total_pages) &&
    typeof value.pagination.has_more === "boolean";
}

function isOpenAnnouncement(value: unknown): value is OpenAnnouncement {
  return isRecord(value) &&
    Number.isSafeInteger(value.id) &&
    (value.source === undefined || value.source === null || typeof value.source === "string") &&
    typeof value.title === "string" &&
    Array.isArray(value.category_ids) &&
    value.status === "open" &&
    typeof value.detail_url === "string";
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
