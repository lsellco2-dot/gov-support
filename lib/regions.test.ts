import assert from "node:assert/strict";
import test from "node:test";
import {
  compatibleRegionLabels,
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
