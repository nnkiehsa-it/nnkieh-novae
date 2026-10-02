import assert from "node:assert/strict";
import { asRecord, callAction, database, expectActionError, insertRows, integrationTest, seedActor } from "../helpers.ts";

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
