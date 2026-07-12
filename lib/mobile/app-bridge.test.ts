import assert from "node:assert/strict";
import test from "node:test";
import {
  addFavorite,
  getAppInstallationContext,
  getFavorites,
  getFavoritesBridgeAvailability,
  getRecommendationsBridgeAvailability,
  isAppBridgeAvailable,
  isFavorite,
  removeFavorite,
} from "./app-bridge";

test("distinguishes browser and outdated app bridges", async () => {
  clearWindow();
  assert.equal(getFavoritesBridgeAvailability(), "browser");
  assert.equal(getRecommendationsBridgeAvailability(), "browser");
  assert.equal(isAppBridgeAvailable(), false);
  assert.equal(await getAppInstallationContext(), null);

  setWindow({ getInstallationContext: () => "{}" });
  assert.equal(getFavoritesBridgeAvailability(), "outdated");
  assert.equal(getRecommendationsBridgeAvailability(), "outdated");
  clearWindow();
});

test("keeps legacy installation context and parses favorite methods", async () => {
  let addedPayload = "";
  setWindow({
    getInstallationContext: async () => JSON.stringify({
      installation_id: "123e4567-e89b-42d3-a456-426614174000",
      installation_token: "a".repeat(64),
      platform: "android",
      app_version: "0.1.0",
    }),
    getFavorites: async () => success([favorite(1)]),
    isFavorite: async () => success({ announcement_id: 1, is_favorite: true }),
    addFavorite: async (payload: string) => {
      addedPayload = payload;
      return success(favorite(1));
    },
    removeFavorite: async () => success({ announcement_id: 1, removed: true }),
    getUserCondition: async () => success({
      user_type: "small_business",
      region: "seoul",
      industry: "retail",
      interests: ["finance_loan_guarantee"],
      startup_years: "years_1_3",
      onboarding_completed: true,
      schema_version: 1,
    }),
  });

  assert.equal(isAppBridgeAvailable(), true);
  assert.equal((await getAppInstallationContext())?.platform, "android");
  assert.equal((await getFavorites()).success, true);
  assert.deepEqual(await isFavorite(1), { success: true, data: true });
  assert.deepEqual(await removeFavorite(1), { success: true, data: true });

  const added = await addFavorite({
    id: 1,
    title: "공고",
    agency: "기관",
    category_ids: [3],
    region: "전국",
    status: "open",
    apply_end: "2026-08-31",
    detail_url: "/app/announcements/1",
    original_url: null,
  });
  assert.equal(added.success, true);
  assert.equal(
    JSON.parse(addedPayload).detail_url,
    "https://gov-support-nine.vercel.app/app/announcements/1",
  );
  clearWindow();
});

function success(data: unknown) {
  return JSON.stringify({ success: true, data });
}

function favorite(id: number) {
  return {
    id,
    title: "공고",
    agency: "기관",
    category_ids: [3],
    region: "전국",
    status: "open",
    apply_end: "2026-08-31",
    detail_url: `https://gov-support-nine.vercel.app/app/announcements/${id}`,
    original_url: null,
    favorited_at: 100,
  };
}

function setWindow(bridge: Record<string, unknown>) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      GovSupportApp: bridge,
      location: { origin: "https://gov-support-nine.vercel.app" },
    },
  });
}

function clearWindow() {
  Reflect.deleteProperty(globalThis, "window");
}
