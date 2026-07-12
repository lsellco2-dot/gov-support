import assert from "node:assert/strict";
import test from "node:test";
import {
  hashInstallationToken,
  parseAnnouncementId,
  parseInstallationHeaders,
  tokenHashMatches,
} from "./installation-auth";

const INSTALLATION_ID = "550e8400-e29b-41d4-a716-446655440000";
const TOKEN = "test-installation-token-with-more-than-32-characters";

test("accepts valid installation headers", () => {
  const headers = new Headers({
    "X-Installation-Id": INSTALLATION_ID,
    "X-Installation-Token": TOKEN,
  });
  assert.deepEqual(parseInstallationHeaders(headers), {
    installationId: INSTALLATION_ID,
    installationToken: TOKEN,
  });
});

test("rejects missing, malformed, and short credentials", () => {
  assert.equal(parseInstallationHeaders(new Headers()), null);
  assert.equal(
    parseInstallationHeaders(
      new Headers({ "X-Installation-Id": "not-a-uuid", "X-Installation-Token": TOKEN }),
    ),
    null,
  );
  assert.equal(
    parseInstallationHeaders(
      new Headers({ "X-Installation-Id": INSTALLATION_ID, "X-Installation-Token": "short" }),
    ),
    null,
  );
});

test("hashes tokens deterministically without retaining plaintext", () => {
  const hash = hashInstallationToken(TOKEN);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.notEqual(hash, TOKEN);
  assert.equal(tokenHashMatches(TOKEN, hash), true);
  assert.equal(tokenHashMatches(`${TOKEN}-wrong`, hash), false);
});

test("accepts only positive safe announcement IDs", () => {
  assert.equal(parseAnnouncementId(123), 123);
  assert.equal(parseAnnouncementId("123"), 123);
  assert.equal(parseAnnouncementId(0), null);
  assert.equal(parseAnnouncementId(-1), null);
  assert.equal(parseAnnouncementId("abc"), null);
});
