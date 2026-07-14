import assert from "node:assert/strict";
import test from "node:test";
import { announcementSourceCode, announcementSourceLabel } from "./announcement-source";

test("maps source ids to public source codes", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(announcementSourceCode),
    ["bizinfo", "kstartup", "mss", "mois", "msit"],
  );
  assert.equal(announcementSourceCode(999), null);
});

test("maps public source codes to user-facing labels", () => {
  assert.deepEqual(
    ["kstartup", "bizinfo", "mss", "mois", "msit"].map(announcementSourceLabel),
    ["K-Startup", "기업마당", "중소벤처기업부", "행정안전부", "과학기술정보통신부"],
  );
});

test("uses a safe label when source is absent or unknown", () => {
  assert.equal(announcementSourceLabel(undefined), "출처 정보 없음");
  assert.equal(announcementSourceLabel(null), "출처 정보 없음");
  assert.equal(announcementSourceLabel("legacy"), "출처 정보 없음");
});
