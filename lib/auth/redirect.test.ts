import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath } from "./redirect";

test("safeNextPath keeps local paths", () => {
  assert.equal(safeNextPath("/recommendations?tab=open"), "/recommendations?tab=open");
});

test("safeNextPath rejects external and protocol-relative redirects", () => {
  assert.equal(safeNextPath("https://example.com"), "/");
  assert.equal(safeNextPath("//example.com"), "/");
  assert.equal(safeNextPath("/\\example.com"), "/");
  assert.equal(safeNextPath(null), "/");
});
