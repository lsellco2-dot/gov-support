import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpenAnnouncementsPayload,
  parseOpenAnnouncementsParams,
} from "./open-announcements";

test("open announcements uses page 1 and limit 50 by default", () => {
  const parsed = parseOpenAnnouncementsParams(new URLSearchParams());
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.deepEqual(parsed.value, { page: 1, limit: 50 });
});

test("open announcements caps limit at 100 and rejects invalid page", () => {
  const capped = parseOpenAnnouncementsParams(new URLSearchParams("page=2&limit=1000"));
  assert.equal(capped.ok, true);
  if (capped.ok) assert.deepEqual(capped.value, { page: 2, limit: 100 });

  const invalid = parseOpenAnnouncementsParams(new URLSearchParams("page=0"));
  assert.equal(invalid.ok, false);
});

test("open announcements exposes only public fields and internal detail URL", () => {
  const row = {
    id: 10,
    source_id: 2,
    title: "공개 공고",
    organization: "기관",
    category_ids: [1, 3],
    region: "전국",
    target: "소상공인",
    support_type: "자금",
    summary: "요약",
    apply_start: "2026-07-01",
    apply_end: "2026-08-31",
    detail_url: "https://source.example/10",
    status: "open" as const,
    created_at: "2026-07-12T00:00:00.000Z",
    raw_json: { private: true },
  };
  const payload = buildOpenAnnouncementsPayload(
    { items: [row], total: 101, page: 1, size: 50 },
    "https://gov-support-nine.vercel.app",
  );

  assert.equal(payload.data[0].detail_url, "https://gov-support-nine.vercel.app/app/announcements/10");
  assert.equal(payload.data[0].original_url, "https://source.example/10");
  assert.equal("summary" in payload.data[0], false);
  assert.equal("raw_json" in payload.data[0], false);
  assert.equal(payload.pagination.has_more, true);
  assert.equal(payload.pagination.total_pages, 3);
});
