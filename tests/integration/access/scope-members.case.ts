import assert from "node:assert/strict";
import { asRecord, callAction, database, expectActionError, insertRows, integrationTest, seedActor, testEnvironment } from "../helpers.ts";

integrationTest("scope member batches commit together, reject stale drafts, and announce each changed account", async () => {
  const admin = await seedActor("scope-batch-admin", { roles: ["platform-admin"] });
  const first = await seedActor("scope-batch-first");
  const second = await seedActor("scope-batch-second");
  const scope = { scopeKind: "issue", categoryId: "public-issues" };
  await expectActionError("invalid-issue-category", () => callAction("listRoleAssignments", { scopeKind: "issue", categoryId: "deleted-category", query: "" }, admin.auth));
  await expectActionError("validation-invalid", () => callAction("listRoleAssignments", { scopeKind: "announcement", categoryId: "public-issues", query: "" }, admin.auth));
  const before = asRecord(await callAction("listRoleAssignments", { ...scope, query: "" }, admin.auth));
  const write = { ...scope, revision: before.revision, changes: [{ uid: first.auth.uid, grant: true }, { uid: second.auth.uid, grant: true }] };
  await expectActionError("permission-denied", () => callAction("saveScopeMembers", write, first.auth));
  await expectActionError("not-found", () => callAction("saveScopeMembers", {
    ...write, changes: [write.changes[0], { uid: "missing-profile", grant: true }],
  }, admin.auth));
  const afterFailed = asRecord(await callAction("listRoleAssignments", { ...scope, query: "" }, admin.auth));
  assert.equal(afterFailed.revision, before.revision);
  assert.deepEqual(afterFailed.users, before.users);
  const operationId = crypto.randomUUID();
  const saved = asRecord(await callAction("saveScopeMembers", write, admin.auth, operationId));
  assert.deepEqual(saved.changedUids, [first.auth.uid, second.auth.uid]);
  assert.notEqual(saved.revision, before.revision);
  const replayed = await callAction("saveScopeMembers", write, admin.auth, operationId);
  assert.deepEqual(replayed, saved);
  await expectActionError("configuration-changed", () => callAction("saveScopeMembers", write, admin.auth));
  const events = await database.sql<{ aggregate_id: string }>`select aggregate_id from app_private.domain_events
    where operation_id = ${operationId} and event_type = 'user.access_scoped' order by aggregate_id`;
  assert.deepEqual(events.rows.map((event) => event.aggregate_id), [first.auth.uid, second.auth.uid].sort());
  const after = asRecord(await callAction("listRoleAssignments", { ...scope, query: "" }, admin.auth));
  assert.equal(after.revision, saved.revision);
  assert.deepEqual((after.users as Array<{ uid: string }>).map((user) => user.uid).sort(), [first.auth.uid, second.auth.uid].sort());
});

integrationTest("scope membership reads do not silently drop the 101st administrator", async () => {
  const admin = await seedActor("large-scope-admin", { roles: ["platform-admin"] });
  const uids = Array.from({ length: 101 }, (_, index) => `scope-member-${String(index).padStart(3, "0")}`);
  await insertRows("user_profiles", uids.map((uid) => ({ uid, display_name: uid, email: `${uid}@integration.invalid` })));
  await insertRows("user_issue_category_assignments", uids.map((uid) => ({ uid, category_id: "public-issues", granted_by: admin.auth.uid })));
  const members = asRecord(await callAction("listRoleAssignments", { scopeKind: "issue", categoryId: "public-issues", query: "" }, admin.auth));
  assert.equal(members.truncated, false);
  assert.equal((members.users as unknown[]).length, 101);
  assert.match(String(members.revision), /^[a-f0-9]{32}$/u);
});

integrationTest("scope access follows configured administrator identities before the target logs in again", async () => {
  const admin = await seedActor("scope-identity-admin", { roles: ["platform-admin"] });
  const promoted = await seedActor("scope-promoted");
  const former = await seedActor("scope-former-admin", { roles: ["platform-admin"] });
  testEnvironment.ADMIN_EMAILS = testEnvironment.ADMIN_EMAILS.split(",").filter((email) => email !== former.identity.email).join(",")
    + `,${promoted.identity.email}`;
  await database.sql`update app_private.user_profiles set email = ${promoted.identity.email.toUpperCase()} where uid = ${promoted.auth.uid}`;
  const promotedLookup = asRecord(await callAction("listRoleAssignments", { query: ` ${promoted.identity.email} ` }, admin.auth));
  assert.deepEqual((promotedLookup.users as Array<{ roles: string[] }>)[0].roles, ["platform-admin"]);
  await expectActionError("permission-denied", () => callAction("setUserAccessScope", {
    uid: promoted.auth.uid, scopeKind: "issue", categoryId: "public-issues", grant: true,
  }, admin.auth));
  const formerLookup = asRecord(await callAction("listRoleAssignments", { query: former.identity.email }, admin.auth));
  assert.deepEqual((formerLookup.users as Array<{ roles: string[] }>)[0].roles, []);
  const scope = { scopeKind: "issue", categoryId: "public-issues" };
  const before = asRecord(await callAction("listRoleAssignments", { ...scope, query: "" }, admin.auth));
  const saved = asRecord(await callAction("saveScopeMembers", {
    ...scope, revision: before.revision, changes: [{ uid: former.auth.uid, grant: true }],
  }, admin.auth));
  assert.deepEqual((saved.users as Array<{ uid: string; roles: string[]; managedIssueCategoryIds: string[] }>), [{
    ...(formerLookup.users as object[])[0], managedIssueCategoryIds: ["public-issues"],
  }]);
  const roles = await database.sql`select role_code from app_private.user_role_assignments where uid = ${former.auth.uid}`;
  assert.equal(roles.rows.length, 0);
  const audit = await database.sql`select uid from app_private.role_assignment_audit
    where uid = ${former.auth.uid} and role_code = 'platform-admin' and operation = 'revoke'`;
  assert.equal(audit.rows.length, 1);
});
