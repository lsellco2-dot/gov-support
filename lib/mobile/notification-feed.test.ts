import assert from "node:assert/strict";
import test from "node:test";
import {
  buildNotificationFeedPayload,
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
