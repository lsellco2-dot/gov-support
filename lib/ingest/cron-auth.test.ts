import assert from "node:assert/strict";
import test from "node:test";
import { isCronAuthorized } from "./cron-auth";

test("cron authorization requires an exact bearer secret", () => {
  assert.equal(
    isCronAuthorized(
      new Request("https://example.com/api/ingest/youthcenter", {
        headers: { authorization: "Bearer correct-secret" },
      }),
      "correct-secret",
    ),
    true,
  );
  assert.equal(
    isCronAuthorized(
      new Request("https://example.com/api/ingest/youthcenter", {
        headers: { authorization: "Bearer wrong-secret" },
      }),
      "correct-secret",
    ),
    false,
  );
  assert.equal(
    isCronAuthorized(
      new Request("https://example.com/api/ingest/youthcenter"),
      "correct-secret",
    ),
    false,
  );
  assert.equal(
    isCronAuthorized(
      new Request("https://example.com/api/ingest/youthcenter", {
        headers: { authorization: "Bearer anything" },
      }),
      undefined,
    ),
    false,
  );
});
