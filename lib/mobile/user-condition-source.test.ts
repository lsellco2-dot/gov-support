import assert from "node:assert/strict";
import test from "node:test";
import { resolveUserCondition } from "./user-condition-source";
import { WEB_USER_CONDITION_STORAGE_KEY } from "./user-condition";

const webCondition = condition("seoul");
const nativeCondition = condition("busan");

test("uses a valid Android condition before a browser condition", async () => {
  setWindow({
    bridge: completeBridge(async () => success(nativeCondition)),
    storedCondition: webCondition,
  });
  assert.deepEqual(await resolveUserCondition(), {
    status: "ready",
    source: "native",
    condition: nativeCondition,
  });
  clearWindow();
});

test("uses localStorage only when no app bridge exists", async () => {
  setWindow({ storedCondition: webCondition });
  assert.deepEqual(await resolveUserCondition(), {
    status: "ready",
    source: "web",
    condition: webCondition,
  });
  clearWindow();
});

test("does not fall back to web data when the Android bridge fails", async () => {
  setWindow({
    bridge: completeBridge(async () => {
      throw new Error("bridge failed");
    }),
    storedCondition: webCondition,
  });
  assert.deepEqual(await resolveUserCondition(), {
    status: "error",
    source: "native",
  });
  clearWindow();
});

test("handles an outdated bridge and a browser without a condition", async () => {
  setWindow({ bridge: { getInstallationContext: () => "{}" } });
  assert.deepEqual(await resolveUserCondition(), {
    status: "outdated",
    source: "native",
  });

  setWindow({});
  assert.deepEqual(await resolveUserCondition(), {
    status: "missing",
    source: "web",
  });
  clearWindow();
});

function completeBridge(getUserCondition: () => Promise<string>) {
  return {
    getUserCondition,
    getFavorites: () => success([]),
    isFavorite: () => success({ announcement_id: 1, is_favorite: false }),
    addFavorite: () => success({}),
    removeFavorite: () => success({ announcement_id: 1, removed: true }),
  };
}

function condition(region: string) {
  return {
    user_type: "small_business",
    region,
    industry: "retail",
    interests: ["finance_loan_guarantee"],
    startup_years: "years_1_3",
    onboarding_completed: true,
    schema_version: 1,
  };
}

function success(data: unknown) {
  return JSON.stringify({ success: true, data });
}

function setWindow({
  bridge,
  storedCondition,
}: {
  bridge?: Record<string, unknown>;
  storedCondition?: unknown;
}) {
  const values = new Map<string, string>();
  if (storedCondition) {
    values.set(WEB_USER_CONDITION_STORAGE_KEY, JSON.stringify(storedCondition));
  }
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      GovSupportApp: bridge,
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  });
}

function clearWindow() {
  Reflect.deleteProperty(globalThis, "window");
}
