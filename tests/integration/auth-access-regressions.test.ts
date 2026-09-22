import assert from "node:assert/strict";
import { callAction, database, expectActionError, integrationTest, refreshActor, seedActor, testEnvironment } from "./helpers.ts";
import { resolveAccountAccessRule } from "../../cloudflare/src/backend/shared/account-access.ts";

integrationTest("revoking ADMIN_EMAILS removes cached DB authority before the next action", async () => {
  const actor = await seedActor("revoked-admin", { roles: ["platform-admin"] });
  assert.equal(actor.auth.isAdmin, true);
  testEnvironment.ADMIN_EMAILS = "admin@integration.invalid";
  const revoked = await refreshActor(actor);
  assert.equal(revoked.auth.isAdmin, false);
  assert.equal(revoked.auth.roles.includes("platform-admin"), false);
  assert.equal(revoked.auth.permissions.includes("role.manage"), false);
  await expectActionError("permission-denied", () => callAction("listAccountAccessRules", {}, revoked.auth));
  const stored = await database.sqlMaybe`select uid from app_private.user_role_assignments where uid=${actor.auth.uid} and role_code='platform-admin'`;
  assert.equal(stored, null);
});

integrationTest("email prefixes treat percent and underscore literally", async () => {
  const admin = await seedActor("prefix-admin", { roles: ["platform-admin"] });
  for (const prefix of ["%", "audit_"]) {
    await callAction("saveAccountAccessRule", { targetType: "email_prefix", targetValue: prefix, preset: "blocked", duration: "permanent", message: "test" }, admin.auth);
  }
  assert.equal(await resolveAccountAccessRule(database, { uid: "unrelated", email: "auditXuser@integration.invalid" }), null);
  assert.equal((await resolveAccountAccessRule(database, { uid: "literal", email: "audit_user@integration.invalid" }))?.targetValue, "audit_");
  assert.equal((await resolveAccountAccessRule(database, { uid: "percent", email: "%user@integration.invalid" }))?.targetValue, "%");
});
