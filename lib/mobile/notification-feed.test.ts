import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNewMatchNotificationFeedPayload,
  buildNotificationFeedPayload,
  decodeNewMatchCursor,
  encodeNewMatchCursor,
  newMatchFeedWindow,
  type NotificationFeedDbRow,
  parseNotificationFeedParams,
} from "./notification-feed";

const NOW = new Date("2026-07-12T03:00:00.000Z");
const ORIGIN = "https://gov-support.example";

const baseRow: NotificationFeedDbRow = {
  id: 101,
  source_id: 2,
  source_key: "notice-101",
  title: "테스트 공고",
  organization: "테스트 기관",
  category_ids: [1, 3],
  region: "서울",
  target: "소상공인",
  support_type: "자금지원",
  status: "open",
  apply_start: "2026-07-01",
  apply_end: "2026-08-31",
  created_at: "2026-07-11T10:00:00.000Z",
  updated_at: "2026-07-12T01:00:00.000Z",
  detail_url: "https://source.example/notice-101",
};

function params(query = "since=2026-07-10T00%3A00%3A00.000Z&deadlineWithinDays=7&limit=100") {
  const parsed = parseNotificationFeedParams(new URLSearchParams(query));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) throw new Error("expected valid params");
  return parsed.value;
}

function newMatchParams(query = "mode=new_matches&limit=100") {
  return params(query);
}

test("rejects an invalid since timestamp", () => {
  const parsed = parseNotificationFeedParams(new URLSearchParams("since=yesterday"));
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.error.code, "INVALID_SINCE");
});

test("caps limit at 100", () => {
  const parsed = parseNotificationFeedParams(new URLSearchParams("limit=1000"));
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.value.limit, 100);
});

test("rejects an invalid deadline window", () => {
  const parsed = parseNotificationFeedParams(
    new URLSearchParams("deadlineWithinDays=31"),
  );
  assert.equal(parsed.ok, false);
  if (!parsed.ok) assert.equal(parsed.error.code, "INVALID_DEADLINE_WINDOW");
});

test("rejects invalid new-match modes and opaque cursors", () => {
  const invalidMode = parseNotificationFeedParams(
    new URLSearchParams("mode=anything"),
  );
  assert.equal(invalidMode.ok, false);
  if (!invalidMode.ok) assert.equal(invalidMode.error.code, "INVALID_MODE");

  const invalidCursor = parseNotificationFeedParams(
    new URLSearchParams("mode=new_matches&cursor=not-a-cursor"),
  );
  assert.equal(invalidCursor.ok, false);
  if (!invalidCursor.ok) assert.equal(invalidCursor.error.code, "INVALID_CURSOR");
});

test("returns an empty feed for empty rows", () => {
  const payload = buildNotificationFeedPayload([], [], params(), ORIGIN, NOW);
  assert.deepEqual(payload.data, []);
  assert.equal(payload.pagination.has_more, false);
  assert.equal(payload.pagination.next_cursor, null);
});

test("returns only explicit public fields and marks a newly stored announcement", () => {
  const rowWithPrivateData = {
    ...baseRow,
    raw_json: { secret: true },
    content_hash: "internal",
  } as NotificationFeedDbRow & { raw_json: unknown; content_hash: string };
  const payload = buildNotificationFeedPayload(
    [rowWithPrivateData],
    [{ id: 2, code: "kstartup" }],
    params(),
    ORIGIN,
    NOW,
  );
  const item = payload.data[0];
  assert.equal(item.source, "kstartup");
  assert.deepEqual(item.notification_types, ["new"]);
  assert.equal(item.detail_url, `${ORIGIN}/app/announcements/101`);
  assert.equal(item.original_url, baseRow.detail_url);
  assert.equal("raw_json" in item, false);
  assert.equal("content_hash" in item, false);
});

test("uses created_at instead of updated_at for new-announcement detection", () => {
  const modifiedOldRow = {
    ...baseRow,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-07-12T02:59:00.000Z",
  };
  const payload = buildNotificationFeedPayload(
    [modifiedOldRow],
    [{ id: 2, code: "kstartup" }],
    params(),
    ORIGIN,
    NOW,
  );
  assert.deepEqual(payload.data, []);
});

test("marks an open announcement ending within seven days", () => {
  const deadlineRow = {
    ...baseRow,
    created_at: "2026-06-01T00:00:00.000Z",
    apply_end: "2026-07-18",
  };
  const payload = buildNotificationFeedPayload(
    [deadlineRow],
    [{ id: 2, code: "kstartup" }],
    params(),
    ORIGIN,
    NOW,
  );
  assert.deepEqual(payload.data[0].notification_types, ["deadline"]);
  assert.equal(payload.data[0].apply_end, "2026-07-18");
});

test("excludes closed announcements defensively", () => {
  const closedRow = {
    ...baseRow,
    status: "closed",
    apply_end: "2026-07-13",
  };
  const payload = buildNotificationFeedPayload(
    [closedRow],
    [{ id: 2, code: "kstartup" }],
    params(),
    ORIGIN,
    NOW,
  );
  assert.deepEqual(payload.data, []);
});

test("new-match cursor round-trips without exposing query structure", () => {
  const cursor = {
    version: 2 as const,
    firstSeenAt: "2026-07-11T10:00:00.000Z",
    announcementId: 101,
    throughAt: NOW.toISOString(),
  };
  const encoded = encodeNewMatchCursor(cursor);
  assert.equal(encoded.includes("2026-07"), false);
  assert.deepEqual(decodeNewMatchCursor(encoded), cursor);
});

test("new-match first activation scans only the previous 24 hours", () => {
  assert.deepEqual(newMatchFeedWindow(null, NOW), {
    firstSeenAt: "2026-07-11T03:00:00.000Z",
    announcementId: 0,
    throughAt: NOW.toISOString(),
  });
});

test("new-match feed keeps stable ascending order for equal first-seen timestamps", () => {
  const rows = [
    { ...baseRow, id: 103, source_key: "notice-103" },
    { ...baseRow, id: 101, source_key: "notice-101" },
    { ...baseRow, id: 102, source_key: "notice-102" },
  ];
  const payload = buildNewMatchNotificationFeedPayload(
    rows,
    [{ id: 2, code: "kstartup" }],
    newMatchParams("mode=new_matches&limit=2"),
    ORIGIN,
    NOW,
  );
  assert.deepEqual(payload.items.map((item) => item.id), [101, 102]);
  assert.equal(payload.hasMore, true);

  const cursor = decodeNewMatchCursor(payload.nextCursor);
  assert.equal(cursor?.firstSeenAt, baseRow.created_at);
  assert.equal(cursor?.announcementId, 102);
  assert.equal(cursor?.throughAt, NOW.toISOString());
});

test("new-match cursor boundary has no duplicate or missing equal-time ids", () => {
  const cursor = encodeNewMatchCursor({
    version: 2,
    firstSeenAt: baseRow.created_at,
    announcementId: 101,
    throughAt: NOW.toISOString(),
  });
  const payload = buildNewMatchNotificationFeedPayload(
    [
      { ...baseRow, id: 101 },
      { ...baseRow, id: 102, source_key: "notice-102" },
      { ...baseRow, id: 103, source_key: "notice-103" },
    ],
    [{ id: 2, code: "kstartup" }],
    newMatchParams(`mode=new_matches&cursor=${cursor}`),
    ORIGIN,
    NOW,
  );
  assert.deepEqual(payload.items.map((item) => item.id), [102, 103]);
  assert.equal(payload.hasMore, false);
});

test("completed new-match cursor advances the next server-time window", () => {
  const firstRunAt = new Date("2026-07-26T00:00:00.000Z");
  const nextRunAt = new Date("2026-07-26T12:00:00.000Z");
  const parsed = parseNotificationFeedParams(new URLSearchParams("mode=new_matches"));
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const completed = buildNewMatchNotificationFeedPayload(
    [],
    [],
    parsed.value,
    "https://gov-support-nine.vercel.app",
    firstRunAt,
  );
  const cursor = decodeNewMatchCursor(completed.nextCursor);
  assert.ok(cursor);
  const nextWindow = newMatchFeedWindow(cursor, nextRunAt);
  assert.equal(nextWindow.firstSeenAt, firstRunAt.toISOString());
  assert.equal(nextWindow.throughAt, nextRunAt.toISOString());
});

test("new-match feed does not treat an updated old announcement as new", () => {
  const payload = buildNewMatchNotificationFeedPayload(
    [{
      ...baseRow,
      created_at: "2026-07-10T02:00:00.000Z",
      updated_at: "2026-07-12T02:59:00.000Z",
    }],
    [{ id: 2, code: "kstartup" }],
    newMatchParams(),
    ORIGIN,
    NOW,
  );
  assert.deepEqual(payload.items, []);
});

test("new-match feed excludes closed or already expired announcements", () => {
  const payload = buildNewMatchNotificationFeedPayload(
    [
      { ...baseRow, id: 201, status: "closed", apply_end: "2026-07-20" },
      { ...baseRow, id: 202, status: "open", apply_end: "2026-07-11" },
      { ...baseRow, id: 203, status: "upcoming", apply_end: "2026-07-20" },
    ],
    [{ id: 2, code: "kstartup" }],
    newMatchParams(),
    ORIGIN,
    NOW,
  );
  assert.deepEqual(payload.items.map((item) => item.id), [203]);
});

test("legacy notification feed response remains backward compatible", () => {
  const payload = buildNotificationFeedPayload(
    [baseRow],
    [{ id: 2, code: "kstartup" }],
    params(),
    ORIGIN,
    NOW,
  );
  assert.equal(Array.isArray(payload.data), true);
  assert.equal(typeof payload.pagination.has_more, "boolean");
  assert.equal("items" in payload, false);
});
