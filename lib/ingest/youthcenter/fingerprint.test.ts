import assert from "node:assert/strict";
import test from "node:test";
import {
  createYouthCenterSourceFingerprint,
  normalizeFingerprintText,
} from "./fingerprint";

const BASE = {
  title: "청년 <b>취업</b> 지원",
  organization: "서울특별시",
  regions: ["경기", "서울"],
  applyStart: "2026-07-01",
  applyEnd: "2026-08-31",
  summary: "면접비 &amp; 교통비 지원",
  target: "만 19세 ~ 39세",
};

test("fingerprint normalization ignores HTML, spacing, case, and region order", () => {
  const left = createYouthCenterSourceFingerprint(BASE);
  const right = createYouthCenterSourceFingerprint({
    ...BASE,
    title: "청년 취업---지원",
    organization: " 서울특별시 ",
    regions: ["서울", "경기", "서울"],
    summary: "면접비 & 교통비 지원",
    target: "만 19세~39세",
  });
  assert.equal(left, right);
  assert.equal(normalizeFingerprintText(null), "");
  assert.equal(normalizeFingerprintText(""), "");
});

test("source key and URLs are outside the fingerprint while target remains material", () => {
  const base = createYouthCenterSourceFingerprint(BASE);
  assert.notEqual(
    base,
    createYouthCenterSourceFingerprint({
      ...BASE,
      target: "만 19세 ~ 34세",
    }),
  );
});
