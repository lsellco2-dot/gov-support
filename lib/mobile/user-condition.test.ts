import assert from "node:assert/strict";
import test from "node:test";
import {
  clearWebUserCondition,
  normalizeUserCondition,
  readWebUserCondition,
  saveWebUserCondition,
  type StorageLike,
  updateWebUserCondition,
  WEB_USER_CONDITION_STORAGE_KEY,
} from "./user-condition";

const validCondition = {
  user_type: "small_business",
  region: "seoul",
  industry: "retail",
  interests: ["finance_loan_guarantee", "startup_support"],
  startup_years: "years_1_3",
  onboarding_completed: true,
  schema_version: 1,
};

test("stores, reads, updates and clears a web user condition", () => {
  const storage = memoryStorage();
  assert.equal(readWebUserCondition(storage), null);

  const saved = saveWebUserCondition(validCondition, storage);
  assert.equal(saved.success, true);
  assert.deepEqual(readWebUserCondition(storage), validCondition);

  const updated = updateWebUserCondition({ region: "busan" }, storage);
  assert.equal(updated.success, true);
  assert.equal(readWebUserCondition(storage)?.region, "busan");

  assert.deepEqual(clearWebUserCondition(storage), { success: true, data: null });
  assert.equal(readWebUserCondition(storage), null);
});

test("safely rejects damaged JSON, unknown versions and invalid fields", () => {
  const storage = memoryStorage();
  storage.setItem(WEB_USER_CONDITION_STORAGE_KEY, "{broken");
  assert.equal(readWebUserCondition(storage), null);

  storage.setItem(
    WEB_USER_CONDITION_STORAGE_KEY,
    JSON.stringify({ ...validCondition, schema_version: 2 }),
  );
  assert.equal(readWebUserCondition(storage), null);
  assert.equal(
    saveWebUserCondition({ ...validCondition, region: "unsupported" }, storage).success,
    false,
  );
  assert.equal(
    saveWebUserCondition({ ...validCondition, interests: ["unsupported"] }, storage).success,
    false,
  );
});

test("trims values, removes duplicate interests and fixes worker startup years", () => {
  assert.deepEqual(
    normalizeUserCondition({
      ...validCondition,
      user_type: " job_seeker_worker ",
      region: " seoul ",
      interests: [" startup_support ", "", "startup_support"],
      startup_years: "years_3_7",
    }),
    {
      ...validCondition,
      user_type: "job_seeker_worker",
      region: "seoul",
      interests: ["startup_support"],
      startup_years: "not_applicable",
    },
  );
});

test("does not access browser storage during server rendering", () => {
  assert.equal(readWebUserCondition(null), null);
  assert.deepEqual(saveWebUserCondition(validCondition, null), {
    success: false,
    error: "STORAGE_UNAVAILABLE",
  });
});

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
  };
}
