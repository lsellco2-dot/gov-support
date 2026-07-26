import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { NativeUserCondition } from "./app-bridge";
import {
  evaluateNewMatchNotificationCandidate,
  type OpenAnnouncement,
} from "./recommendations";

interface Fixture {
  name: string;
  condition: NativeUserCondition;
  announcement: Pick<
    OpenAnnouncement,
    "status" | "category_ids" | "region" | "regions" | "target"
  >;
  include_nationwide: boolean;
  eligible: boolean;
  reason_count: number;
}

const fixtures = JSON.parse(
  readFileSync(
    new URL("./notification-matching-fixtures.json", import.meta.url),
    "utf8",
  ),
) as Fixture[];

for (const fixture of fixtures) {
  test(`new-match parity: ${fixture.name}`, () => {
    const result = evaluateNewMatchNotificationCandidate(
      fixture.condition,
      {
        id: 1,
        source: "fixture",
        title: fixture.name,
        agency: "fixture",
        support_type: null,
        apply_start: null,
        apply_end: null,
        created_at: "2026-07-26T00:00:00.000Z",
        detail_url:
          "https://gov-support-nine.vercel.app/app/announcements/1",
        original_url: null,
        ...fixture.announcement,
      },
      fixture.include_nationwide,
    );
    assert.equal(Boolean(result), fixture.eligible);
    assert.equal(result?.reasons.length ?? 0, fixture.reason_count);
  });
}
