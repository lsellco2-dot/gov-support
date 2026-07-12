import { supabaseAnon } from "@/lib/supabase/anon";

const DEFAULT_DEADLINE_WITHIN_DAYS = 7;
const MAX_DEADLINE_WITHIN_DAYS = 30;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 100;
const ISO_TIMESTAMP =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const PUBLIC_SELECT = [
  "id",
  "source_id",
  "source_key",
  "title",
  "organization",
  "category_ids",
  "region",
  "target",
  "support_type",
  "status",
  "apply_start",
  "apply_end",
  "created_at",
  "updated_at",
  "detail_url",
].join(",");

export interface NotificationFeedParams {
  since: string | null;
  deadlineWithinDays: number;
  limit: number;
  cursor: NotificationFeedCursor | null;
}

interface NotificationFeedCursor {
  version: 1;
  createdAt: string;
  id: number;
}

export interface NotificationFeedDbRow {
  id: number;
  source_id: number;
  source_key: string;
  title: string;
  organization: string | null;
  category_ids: number[] | null;
  region: string | null;
  target: string | null;
  support_type: string | null;
  status: string;
  apply_start: string | null;
  apply_end: string | null;
  created_at: string;
  updated_at: string;
  detail_url: string | null;
}

interface SourceRow {
  id: number;
  code: string;
}

export type NotificationType = "new" | "deadline";

type ParseResult =
  | { ok: true; value: NotificationFeedParams }
  | { ok: false; error: { code: string; message: string } };

type IntegerParseResult =
  | { ok: true; value: number }
  | { ok: false; error: { code: string; message: string } };

export function parseNotificationFeedParams(searchParams: URLSearchParams): ParseResult {
  const sinceValue = searchParams.get("since")?.trim() || null;
  let since: string | null = null;
  if (sinceValue) {
    if (!ISO_TIMESTAMP.test(sinceValue)) {
      return invalid("INVALID_SINCE", "since must be an ISO-8601 timestamp with a timezone.");
    }
    const parsed = new Date(sinceValue);
    if (Number.isNaN(parsed.getTime())) {
      return invalid("INVALID_SINCE", "since must be a valid ISO-8601 timestamp.");
    }
    since = parsed.toISOString();
  }

  const deadlineResult = parseBoundedInteger(
    searchParams.get("deadlineWithinDays"),
    DEFAULT_DEADLINE_WITHIN_DAYS,
    1,
    MAX_DEADLINE_WITHIN_DAYS,
    "INVALID_DEADLINE_WINDOW",
    "deadlineWithinDays must be an integer between 1 and 30.",
    false,
  );
  if (!deadlineResult.ok) return deadlineResult;

  const limitResult = parseBoundedInteger(
    searchParams.get("limit"),
    DEFAULT_LIMIT,
    1,
    MAX_LIMIT,
    "INVALID_LIMIT",
    "limit must be a positive integer.",
    true,
  );
  if (!limitResult.ok) return limitResult;

  const cursorValue = searchParams.get("cursor")?.trim() || null;
  let cursor: NotificationFeedCursor | null = null;
  if (cursorValue) {
    cursor = decodeCursor(cursorValue);
    if (!cursor) {
      return invalid("INVALID_CURSOR", "cursor is invalid.");
    }
  }

  return {
    ok: true,
    value: {
      since,
      deadlineWithinDays: deadlineResult.value,
      limit: limitResult.value,
      cursor,
    },
  };
}

export async function queryNotificationFeed(params: NotificationFeedParams, now = new Date()) {
  const window = notificationWindow(now, params.deadlineWithinDays);
  const reasonFilters = [
    `and(apply_end.gte.${window.deadlineFrom},apply_end.lte.${window.deadlineTo})`,
  ];
  if (params.since) reasonFilters.unshift(`created_at.gt.${params.since}`);

  let announcementsQuery = supabaseAnon
    .from("announcements_public")
    .select(PUBLIC_SELECT)
    .eq("status", "open")
    .or(reasonFilters.join(","));

  if (params.cursor) {
    announcementsQuery = announcementsQuery.or(
      `created_at.lt.${params.cursor.createdAt},and(created_at.eq.${params.cursor.createdAt},id.lt.${params.cursor.id})`,
    );
  }

  announcementsQuery = announcementsQuery
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(params.limit + 1);

  const [announcementResult, sourceResult] = await Promise.all([
    announcementsQuery,
    supabaseAnon.from("sources").select("id,code"),
  ]);

  if (announcementResult.error || sourceResult.error) {
    throw new Error("notification feed query failed");
  }

  return {
    rows: (announcementResult.data ?? []) as unknown as NotificationFeedDbRow[],
    sources: (sourceResult.data ?? []) as SourceRow[],
  };
}

export function buildNotificationFeedPayload(
  rows: NotificationFeedDbRow[],
  sources: SourceRow[],
  params: NotificationFeedParams,
  origin: string,
  now = new Date(),
) {
  const window = notificationWindow(now, params.deadlineWithinDays);
  const sourceCodes = new Map(sources.map((source) => [source.id, source.code]));
  const eligibleRows = rows.filter((row) => notificationTypes(row, params, window).length > 0);
  const hasMore = eligibleRows.length > params.limit;
  const pageRows = eligibleRows.slice(0, params.limit);
  const items = pageRows.map((row) => ({
    id: row.id,
    source: sourceCodes.get(row.source_id) ?? "unknown",
    source_key: row.source_key,
    title: row.title,
    agency: row.organization,
    category_ids: normalizeCategoryIds(row.category_ids),
    region: row.region,
    target: row.target,
    support_type: row.support_type,
    status: "open" as const,
    apply_start: normalizeDate(row.apply_start),
    apply_end: normalizeDate(row.apply_end),
    created_at: normalizeTimestamp(row.created_at),
    updated_at: normalizeTimestamp(row.updated_at),
    detail_url: new URL(`/app/announcements/${row.id}`, origin).toString(),
    original_url: safeHttpUrl(row.detail_url),
    notification_types: notificationTypes(row, params, window),
  }));

  const lastRow = pageRows.at(-1);
  return {
    data: items,
    pagination: {
      limit: params.limit,
      has_more: hasMore,
      next_cursor: hasMore && lastRow ? encodeCursor(lastRow) : null,
    },
    window: {
      since: params.since,
      deadline_within_days: params.deadlineWithinDays,
      deadline_from: window.deadlineFrom,
      deadline_to: window.deadlineTo,
    },
    generated_at: now.toISOString(),
  };
}

function notificationTypes(
  row: NotificationFeedDbRow,
  params: NotificationFeedParams,
  window: ReturnType<typeof notificationWindow>,
): NotificationType[] {
  if (row.status !== "open") return [];
  const types: NotificationType[] = [];
  const createdAt = new Date(row.created_at).getTime();
  if (params.since && Number.isFinite(createdAt) && createdAt > new Date(params.since).getTime()) {
    types.push("new");
  }
  if (
    row.apply_end &&
    ISO_DATE.test(row.apply_end) &&
    row.apply_end >= window.deadlineFrom &&
    row.apply_end <= window.deadlineTo
  ) {
    types.push("deadline");
  }
  return types;
}

function notificationWindow(now: Date, deadlineWithinDays: number) {
  const deadlineFrom = dateInKst(now);
  return {
    deadlineFrom,
    deadlineTo: addDays(deadlineFrom, deadlineWithinDays),
  };
}

function dateInKst(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeCategoryIds(value: number[] | null) {
  return Array.from(
    new Set((value ?? []).filter((id) => Number.isInteger(id) && id >= 1 && id <= 9)),
  ).sort((a, b) => a - b);
}

function normalizeDate(value: string | null) {
  return value && ISO_DATE.test(value) ? value : null;
}

function normalizeTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function safeHttpUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function encodeCursor(row: Pick<NotificationFeedDbRow, "created_at" | "id">) {
  const cursor: NotificationFeedCursor = {
    version: 1,
    createdAt: normalizeTimestamp(row.created_at) ?? row.created_at,
    id: row.id,
  };
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string): NotificationFeedCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<NotificationFeedCursor>;
    if (
      parsed.version !== 1 ||
      typeof parsed.createdAt !== "string" ||
      !ISO_TIMESTAMP.test(parsed.createdAt) ||
      Number.isNaN(new Date(parsed.createdAt).getTime()) ||
      !Number.isSafeInteger(parsed.id) ||
      (parsed.id ?? 0) <= 0
    ) {
      return null;
    }
    return {
      version: 1,
      createdAt: new Date(parsed.createdAt).toISOString(),
      id: parsed.id!,
    };
  } catch {
    return null;
  }
}

function parseBoundedInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
  errorCode: string,
  errorMessage: string,
  clampMaximum: boolean,
): IntegerParseResult {
  if (value === null || value === "") return { ok: true, value: fallback };
  if (!/^\d+$/.test(value)) return invalid(errorCode, errorMessage);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || (!clampMaximum && parsed > max)) {
    return invalid(errorCode, errorMessage);
  }
  return { ok: true, value: Math.min(parsed, max) };
}

function invalid(code: string, message: string): { ok: false; error: { code: string; message: string } } {
  return { ok: false, error: { code, message } };
}
