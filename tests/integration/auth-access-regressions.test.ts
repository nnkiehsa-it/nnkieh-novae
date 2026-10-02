import assert from "node:assert/strict";
import { asRecord, callAction, database, expectActionError, insertRows, integrationTest, refreshActor, seedActor, testEnvironment } from "./helpers.ts";
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

integrationTest("administrative rules preserve exact deadlines and return the effective state with revision checks", async () => {
  const admin = await seedActor("rule-admin", { roles: ["platform-admin"] });
  const member = await seedActor("rule-member");
  await database.query("update app_private.user_profiles set email=$1 where uid=$2", ["Audit_user@integration.invalid", member.auth.uid]);
  await insertRows("user_profiles", [{ uid: "wildcard-unrelated", display_name: "Unrelated", email: "auditXuser@integration.invalid" }]);
  await database.query("update app_private.user_profiles set email=$1 where uid=$2", ["audit_admin@integration.invalid", admin.auth.uid]);
  const input = { targetType: "email_prefix", targetValue: "AUDIT_", preset: "read_only", duration: "custom", durationHours: 3, message: "Original", revision: null };
  const preview = asRecord(await callAction("previewAccountAccessRule", input, admin.auth));
  assert.equal(preview.matchingCount, 1);
  assert.equal(preview.targetValue, "audit_");
  const first = asRecord(asRecord(await callAction("saveAccountAccessRule", input, admin.auth)).rule);
  assert.equal(first.matchCount, 1);
  assert.equal(first.permanent, false);
  assert.equal(first.active, true);
  const kept = asRecord(asRecord(await callAction("saveAccountAccessRule", { ...input, duration: "keep", message: "New message", revision: first.revision }, admin.auth)).rule);
  assert.equal(kept.expiresAt, first.expiresAt);
  assert.notEqual(kept.revision, first.revision);
  for (const action of ["saveAccountAccessRule", "deleteAccountAccessRule", "previewAccountAccessRule"]) {
    await expectActionError("configuration-changed", () => callAction(action, { ...input, revision: first.revision }, admin.auth));
  }
  await expectActionError("validation-invalid", () => callAction("saveAccountAccessRule", { ...input, revision: kept.revision, durationHours: 1.5 }, admin.auth));
  const individual = asRecord(await callAction("saveAccountAccessRule", { targetType: "uid", targetValue: member.auth.uid, preset: "reaction_only", duration: "permanent", message: "Individual", revision: null }, admin.auth));
  const permanent = asRecord(individual.rule);
  assert.equal(permanent.permanent, true);
  assert.equal(permanent.expiresAt, null);
  assert.equal(asRecord(individual.effectiveRule).targetType, "uid");
  const listed = asRecord(await callAction("listAdminUsers", { query: member.auth.uid }, admin.auth));
  const user = asRecord((listed.users as unknown[])[0]);
  assert.equal(asRecord(user.accessRule).permanent, true);
  assert.equal(user.accessRuleRevision, permanent.revision);
  assert.ok(asRecord(user.accessRule).updatedAt);
  const changed = asRecord(await callAction("saveAccountAccessRule", { targetType: "uid", targetValue: member.auth.uid, preset: "read_only", duration: "keep", message: "Keep permanent", revision: permanent.revision }, admin.auth));
  assert.equal(asRecord(changed.rule).permanent, true);
  const removed = asRecord(await callAction("deleteAccountAccessRule", { targetType: "uid", targetValue: member.auth.uid, revision: changed.revision }, admin.auth));
  assert.equal(removed.deleted, true);
  assert.equal(removed.rule, null);
  assert.equal(removed.revision, null);
  assert.equal(asRecord(removed.effectiveRule).targetType, "email_prefix");
  const adminList = asRecord(await callAction("listAdminUsers", { query: admin.auth.uid }, admin.auth));
  assert.equal(asRecord((adminList.users as unknown[])[0]).accessRule, null);
  const prefixRemoved = asRecord(await callAction("deleteAccountAccessRule", { targetType: "email_prefix", targetValue: "AUDIT_", revision: kept.revision }, admin.auth));
  assert.equal(prefixRemoved.deleted, true);
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
