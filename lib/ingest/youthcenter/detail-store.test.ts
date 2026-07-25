import assert from "node:assert/strict";
import test from "node:test";
import { youthCenterDetailSourceHash } from "./detail";
import { shouldFetchYouthCenterDetail } from "./detail-store";

const NOW = Date.parse("2026-07-26T00:00:00.000Z");

test("completed unchanged YouthCenter details are not fetched again", () => {
  const rawJson = { normalized: { sourceUpdatedAt: "2026-07-25" } };
  assert.equal(
    shouldFetchYouthCenterDetail({
      rawJson,
      detailSourceHash: youthCenterDetailSourceHash(rawJson),
      detailFetchedAt: "2026-07-25T00:00:00.000Z",
      detailFetchStatus: "success",
      detailFetchAttemptedAt: "2026-07-25T00:00:00.000Z",
      now: NOW,
    }),
    false,
  );
});

test("changed or missing YouthCenter details are fetched", () => {
  assert.equal(
    shouldFetchYouthCenterDetail({
      rawJson: { version: 2 },
      detailSourceHash: youthCenterDetailSourceHash({ version: 1 }),
      detailFetchedAt: "2026-07-25T00:00:00.000Z",
      detailFetchStatus: "success",
      detailFetchAttemptedAt: "2026-07-25T00:00:00.000Z",
      now: NOW,
    }),
    true,
  );
  assert.equal(
    shouldFetchYouthCenterDetail({
      rawJson: { version: 1 },
      detailSourceHash: null,
      detailFetchedAt: null,
      detailFetchStatus: "pending",
      detailFetchAttemptedAt: null,
      now: NOW,
    }),
    true,
  );
});

test("failed YouthCenter details wait 24 hours before retry", () => {
  const input = {
    rawJson: { version: 1 },
    detailSourceHash: null,
    detailFetchedAt: null,
    detailFetchStatus: "failed",
  };
  assert.equal(
    shouldFetchYouthCenterDetail({
      ...input,
      detailFetchAttemptedAt: "2026-07-25T12:00:00.000Z",
      now: NOW,
    }),
    false,
  );
  assert.equal(
    shouldFetchYouthCenterDetail({
      ...input,
      detailFetchAttemptedAt: "2026-07-24T12:00:00.000Z",
      now: NOW,
    }),
    true,
  );
});
