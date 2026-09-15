import assert from "node:assert/strict";

import {
  asRecord,
  callAction,
  database,
  expectActionError,
  integrationTest,
  refreshActor,
  seedActor,
  underPolicies,
} from "../helpers.ts";
import { handleSyncUser } from "../../../cloudflare/src/backend/sync-user.ts";

integrationTest("admin console restriction and overview actions", async () => {
  const admin = await seedActor("console-admin", { roles: ["platform-admin"] });
  const user = await seedActor("console-user");
  const target = await seedActor("console-target");

  await expectActionError(
    "permission-denied",
    () => callAction("listAdminUsers", { query: target.auth.uid }, user.auth),
  );
  await expectActionError(
    "permission-denied",
    () => callAction("listAdminActivity", { cursor: null, window: "24h" }, user.auth),
  );
  await expectActionError(
    "permission-denied",
    () => callAction("saveAccountAccessRule", {
      targetType: "uid", targetValue: target.auth.uid,
      preset: "read_only", duration: "7d", message: "denied",
    }, user.auth),
  );

  const users = asRecord(await callAction(
    "listAdminUsers",
    { query: target.auth.uid },
    admin.auth,
  ));
  const listedTarget = asRecord((users.users as unknown[])[0]);
  assert.equal(listedTarget.uid, target.auth.uid);
  assert.equal(typeof listedTarget.createdAt, "string");
  assert.equal(Number.isNaN(Date.parse(String(listedTarget.createdAt))), false);
  assert.equal("createdAtMs" in listedTarget, false);
  assert.equal("restrictedUntilMs" in listedTarget, false);
  assert.equal("photoUrl" in listedTarget, true);
  const adminUsers = asRecord(await callAction(
    "listAdminUsers",
    { query: admin.auth.uid },
    admin.auth,
  ));
  const listedAdmin = (adminUsers.users as Array<{ roles: string[]; uid: string }>)[0];
  assert.equal(listedAdmin?.uid, admin.auth.uid);
  assert.ok(listedAdmin?.roles.includes("platform-admin"));

  await expectActionError(
    "permission-denied",
    () => callAction("saveAccountAccessRule", {
      targetType: "uid", targetValue: admin.auth.uid,
      preset: "blocked", duration: "permanent", message: "cannot restrict platform admins",
    }, admin.auth),
  );

  await callAction("saveAccountAccessRule", {
    targetType: "uid", targetValue: target.auth.uid,
    preset: "read_only", duration: "7d", message: "integration test",
  }, admin.auth);

  const restrictedUsers = asRecord(await callAction(
    "listAdminUsers",
    { query: target.auth.uid },
    admin.auth,
  ));
  const listedRestrictedTarget = asRecord((restrictedUsers.users as unknown[])[0]);
  const listedRule = asRecord(listedRestrictedTarget.accessRule);
  assert.equal(listedRule.preset, "read_only");
  assert.equal(typeof listedRule.expiresAt, "string");
  assert.equal(
    Number.isNaN(Date.parse(String(listedRule.expiresAt))),
    false,
  );
  assert.equal("restrictedUntilMs" in listedRestrictedTarget, false);

  const restricted = await refreshActor(target);
  assert.equal(restricted.auth.accessPreset, "read_only");

  await expectActionError(
    "account-restricted",
    () => callAction("createIssue", {
      title: "blocked",
      content: "blocked",
      category: "public-issues",
    }, restricted.auth),
  );

  const announcements = await callAction("listAnnouncements", {}, restricted.auth);
  assert.ok(announcements);

  await expectActionError(
    "account-restricted",
    () => callAction("setAnnouncementLike", { announcementId: "missing", liked: true }, restricted.auth),
  );

  await callAction("saveAccountAccessRule", {
    targetType: "email_prefix", targetValue: "local-test-console-target",
    preset: "blocked", duration: "permanent", message: "未開放給國中部使用",
  }, admin.auth);
  const listedRules = asRecord(await callAction("listAccountAccessRules", {}, admin.auth));
  assert.equal((listedRules.rules as Array<{ targetValue: string }>).some(
    (rule) => rule.targetValue === "local-test-console-target",
  ), true);

  await callAction("deleteAccountAccessRule", {
    targetType: "uid", targetValue: target.auth.uid,
  }, admin.auth);

  const restoredUsers = asRecord(await callAction(
    "listAdminUsers",
    { query: target.auth.uid },
    admin.auth,
  ));
  const listedRestoredTarget = asRecord((restoredUsers.users as unknown[])[0]);
  assert.equal(asRecord(listedRestoredTarget.accessRule).targetType, "email_prefix");
  await assert.rejects(() => refreshActor(target), /account-restricted/);

  await callAction("saveAccountAccessRule", {
    targetType: "uid", targetValue: target.auth.uid,
    preset: "reaction_only", duration: "7d", message: "只能使用反應",
  }, admin.auth);
  const overridden = await refreshActor(target);
  assert.equal(overridden.auth.accessPreset, "reaction_only");
  await expectActionError("account-restricted", () => callAction("createIssue", {
    title: "blocked", content: "blocked", category: "public-issues",
  }, overridden.auth));
  await callAction("deleteAccountAccessRule", { targetType: "uid", targetValue: target.auth.uid }, admin.auth);
  await callAction("deleteAccountAccessRule", { targetType: "email_prefix", targetValue: "local-test-console-target" }, admin.auth);

  const overviewBeforeAging = asRecord(await callAction(
    "getAdminOverview",
    { window: "24h" },
    admin.auth,
  ));
  const activityBeforeAging = overviewBeforeAging.recentActivity as Array<{
    kind: string;
    targetId: string;
  }>;
  assert.equal(
    activityBeforeAging.some(
      (entry) => entry.kind === "admin" && entry.targetId === target.auth.uid,
    ),
    true,
  );
  const activityPage = asRecord(await callAction(
    "listAdminActivity",
    { cursor: null, window: "24h" },
    admin.auth,
  ));
  assert.equal(
    (activityPage.entries as Array<{ kind: string; targetId: string }>).some(
      (entry) => entry.kind === "admin" && entry.targetId === target.auth.uid,
    ),
    true,
  );

  const { rows: queuedAuditEvents } = await database.sql<{ payload: unknown }>`
    select payload from app_private.domain_events where event_type = 'admin.audit_recorded'`;
  assert.ok(queuedAuditEvents.filter(
    (event) => asRecord(event.payload).target_id === target.auth.uid,
  ).length >= 2);

  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
  await database.sql`update app_private.admin_audit_log
    set created_at = ${twoDaysAgo} where target_id = ${target.auth.uid}`;

  const overview = asRecord(await callAction(
    "getAdminOverview",
    { window: "24h" },
    admin.auth,
  ));
  assert.ok(Number(overview.totalUsers) >= 3);
  assert.ok(Number(overview.activeUsers24h) >= 0);
  const activity24h = overview.recentActivity as Array<{ kind: string; targetId: string }>;
  assert.equal(
    activity24h.some((entry) => entry.kind === "admin" && entry.targetId === target.auth.uid),
    false,
  );
  const activity7d = asRecord(await callAction(
    "listAdminActivity",
    { cursor: null, window: "7d" },
    admin.auth,
  ));
  assert.equal(
    (activity7d.entries as Array<{ kind: string; targetId: string }>).some(
      (entry) => entry.kind === "admin" && entry.targetId === target.auth.uid,
    ),
    true,
  );
  const audit = asRecord(await callAction(
    "listAdminAudit",
    { query: "AccountAccessRule" },
    admin.auth,
  ));
  assert.ok((audit.entries as unknown[]).length >= 2);
});

integrationTest("blocked prefixes reject registration before creating a profile", async () => {
  const admin = await seedActor("registration-block-admin", { roles: ["platform-admin"] });
  const targetValue = `blocked-${crypto.randomUUID().slice(0, 8)}`;
  const uid = `unregistered-${crypto.randomUUID()}`;
  const message = "未開放給國中部使用";
  await callAction("saveAccountAccessRule", {
    duration: "permanent",
    message,
    preset: "blocked",
    targetType: "email_prefix",
    targetValue,
  }, admin.auth);

  const response = await underPolicies(() => handleSyncUser({
    customAttributes: "{}",
    email: `${targetValue}001@integration.invalid`,
    name: "Blocked registration",
    photoUrl: null,
    uid,
  }, database));
  assert.equal(response.status, 403);
  const body = asRecord(await response.json());
  assert.equal(asRecord(body.error).message, message);
  const profile = await database.sqlMaybe<{ uid: string }>`
    select uid from app_private.user_profiles where uid = ${uid}`;
  assert.equal(profile, null);
});
