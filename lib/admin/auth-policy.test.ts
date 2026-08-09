import assert from "node:assert/strict";
import test from "node:test";
import {
  adminAccessHttpStatus,
  resolveAdminAccess,
  type AdminIdentity,
} from "./auth-policy";

const user: AdminIdentity = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "admin@example.com",
  displayName: "관리자",
  provider: "google",
};

test("admin access requires an authenticated user with an admin membership", () => {
  const anonymous = resolveAdminAccess(null, null);
  const regular = resolveAdminAccess(user, null);
  const admin = resolveAdminAccess(user, { role: "admin" });

  assert.equal(anonymous.status, "unauthenticated");
  assert.equal(adminAccessHttpStatus(anonymous), 401);
  assert.equal(regular.status, "forbidden");
  assert.equal(adminAccessHttpStatus(regular), 403);
  assert.equal(admin.status, "authorized");
  assert.equal(adminAccessHttpStatus(admin), 200);
});

test("client-controlled or unknown roles never grant admin access", () => {
  assert.equal(resolveAdminAccess(user, { role: "moderator" }).status, "forbidden");
  assert.equal(resolveAdminAccess(user, { role: true }).status, "forbidden");
});
