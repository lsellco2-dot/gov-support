import assert from "node:assert/strict";
import test from "node:test";
import { getAppInstallationContext, isAppBridgeAvailable } from "./app-bridge";

test("does not create installation credentials without an app bridge", async () => {
  assert.equal(isAppBridgeAvailable(), false);
  assert.equal(await getAppInstallationContext(), null);
});
