import assert from "node:assert/strict";
import test from "node:test";
import { nativeBannerAttributes } from "./native-banner";

test("앱 홈과 결과가 있는 추천·즐겨찾기만 준비 상태를 전달한다", () => {
  for (const path of ["/app", "/app/recommendations", "/app/favorites"] as const) {
    assert.deepEqual(nativeBannerAttributes(path, "ready", 1), {
      "data-native-banner-path": path,
      "data-native-banner-ready": "true",
    });
    assert.equal(nativeBannerAttributes(path, "ready", 0)["data-native-banner-ready"], "false");
    for (const state of ["loading", "error", "empty", "browser", "outdated", "no-condition"]) {
      assert.equal(nativeBannerAttributes(path, state, 10)["data-native-banner-ready"], "false");
    }
  }
});

test("기존 전체공고의 최소 4건 조건은 유지한다", () => {
  for (const count of [0, 1, 3]) {
    assert.equal(nativeBannerAttributes("/app/announcements", "ready", count)["data-native-banner-ready"], "false");
  }
  assert.equal(nativeBannerAttributes("/app/announcements", "ready", 4)["data-native-banner-ready"], "true");
});
