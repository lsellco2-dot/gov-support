import assert from "node:assert/strict";
import test from "node:test";
import {
  announcementRegionPostgrestFilter,
  announcementRegionValues,
  compatibleRegionLabels,
  isNationwideAnnouncementRegion,
  matchAnnouncementRegion,
  matchesCompatibleRegion,
  normalizeIntegratedRegionName,
} from "./regions";

test("integrated Gwangju and Jeonnam aliases normalize to the official value", () => {
  assert.equal(
    normalizeIntegratedRegionName("전남광주통합특별시 광양시"),
    "전남광주통합특별시",
  );
  assert.equal(
    normalizeIntegratedRegionName("광주전남통합특별시"),
    "전남광주통합특별시",
  );
  assert.equal(normalizeIntegratedRegionName("서울"), null);
});

test("legacy Gwangju and Jeonnam settings match the integrated region", () => {
  assert.deepEqual(compatibleRegionLabels("광주"), [
    "광주",
    "전남광주통합특별시",
  ]);
  assert.deepEqual(compatibleRegionLabels("전남"), [
    "전남",
    "전남광주통합특별시",
  ]);
  assert.deepEqual(compatibleRegionLabels("전남광주통합특별시"), [
    "전남광주통합특별시",
    "광주",
    "전남",
  ]);
  assert.equal(
    matchesCompatibleRegion("광주", "전남광주통합특별시"),
    true,
  );
  assert.equal(
    matchesCompatibleRegion("전남광주통합특별시", "전남"),
    true,
  );
});

test("announcement regions prefer a valid array and fall back to scalar region", () => {
  assert.deepEqual(
    announcementRegionValues("부산", ["서울", " 경기 ", "서울"]),
    ["서울", "경기"],
  );
  assert.deepEqual(announcementRegionValues("부산", []), ["부산"]);
  assert.deepEqual(announcementRegionValues(null, null), []);
  assert.deepEqual(announcementRegionValues("미확인", null), []);
});

test("single, nationwide, multiple and unresolved announcement regions match safely", () => {
  assert.equal(matchAnnouncementRegion("서울", "서울", null), "match");
  assert.equal(matchAnnouncementRegion("서울", "전국", null), "match");
  assert.equal(
    matchAnnouncementRegion("서울", null, ["경기", "서울"]),
    "match",
  );
  assert.equal(
    matchAnnouncementRegion("서울", "서울", ["부산", "경기"]),
    "conflict",
  );
  assert.equal(matchAnnouncementRegion("서울", null, null), "unknown");
});

test("integrated region compatibility applies to arrays in both directions", () => {
  assert.equal(
    matchAnnouncementRegion("광주", null, ["전남광주통합특별시"]),
    "match",
  );
  assert.equal(
    matchAnnouncementRegion("전남", null, ["전남광주통합특별시"]),
    "match",
  );
  assert.equal(
    matchAnnouncementRegion("전남광주통합특별시", null, ["광주"]),
    "match",
  );
  assert.equal(
    matchAnnouncementRegion("전남광주통합특별시", null, ["전남"]),
    "match",
  );
});

test("nationwide detection follows regions before the scalar fallback", () => {
  assert.equal(isNationwideAnnouncementRegion("서울", ["전국"]), true);
  assert.equal(isNationwideAnnouncementRegion("전국", ["서울"]), false);
  assert.equal(isNationwideAnnouncementRegion("전국", null), true);
});

test("PostgREST region filters cover arrays, legacy scalar rows and unknown fallback", () => {
  assert.equal(
    announcementRegionPostgrestFilter("서울", {
      includeNationwide: true,
      includeUnknown: true,
    }),
    [
      'regions.ov.{"서울","전국"}',
      'and(regions.is.null,region.in.("서울","전국"))',
      'and(regions.eq.{},region.in.("서울","전국"))',
      "and(regions.is.null,region.is.null)",
      "and(regions.eq.{},region.is.null)",
    ].join(","),
  );
  assert.equal(
    announcementRegionPostgrestFilter("광주", {
      includeNationwide: false,
      includeUnknown: false,
    }),
    [
      'and(regions.ov.{"광주","전남광주통합특별시"},regions.not.ov.{"전국"})',
      'and(regions.is.null,region.in.("광주","전남광주통합특별시"))',
      'and(regions.eq.{},region.in.("광주","전남광주통합특별시"))',
    ].join(","),
  );
});
