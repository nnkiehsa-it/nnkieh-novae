import assert from "node:assert/strict";

import {
  asRecord,
  callAction,
  database,
  expectActionError,
  integrationTest,
  refreshActor,
  seedActor,
} from "../helpers.ts";

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
    () => callAction("setUserRestriction", {
      uid: target.auth.uid,
      mode: "7d",
      reason: "denied",
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
    () => callAction("setUserRestriction", {
      uid: admin.auth.uid,
      mode: "permanent",
      reason: "cannot restrict platform admins",
    }, admin.auth),
  );

  await callAction("setUserRestriction", {
    uid: target.auth.uid,
    mode: "7d",
    reason: "integration test",
  }, admin.auth);

  const restrictedUsers = asRecord(await callAction(
    "listAdminUsers",
    { query: target.auth.uid },
    admin.auth,
  ));
  const listedRestrictedTarget = asRecord((restrictedUsers.users as unknown[])[0]);
  assert.equal(typeof listedRestrictedTarget.restrictedUntil, "string");
  assert.equal(
    Number.isNaN(Date.parse(String(listedRestrictedTarget.restrictedUntil))),
    false,
  );
  assert.equal("restrictedUntilMs" in listedRestrictedTarget, false);

  const restricted = await refreshActor(target);
  assert.equal(restricted.auth.interactionRestricted, true);

  await expectActionError(
    "user-muted",
    () => callAction("createIssue", {
      title: "blocked",
      content: "blocked",
      category: "public-issues",
    }, restricted.auth),
  );

  const announcements = await callAction("listAnnouncements", {}, restricted.auth);
  assert.ok(announcements);

  await callAction("setUserRestriction", {
    uid: target.auth.uid,
    mode: "clear",
    reason: "",
  }, admin.auth);

  const restoredUsers = asRecord(await callAction(
    "listAdminUsers",
    { query: target.auth.uid },
    admin.auth,
  ));
  const listedRestoredTarget = asRecord((restoredUsers.users as unknown[])[0]);
  assert.equal(listedRestoredTarget.restrictedUntil, null);

  const restored = await refreshActor(target);
  assert.equal(restored.auth.interactionRestricted, false);

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
    { query: "setUserRestriction" },
    admin.auth,
  ));
  assert.ok((audit.entries as unknown[]).length >= 2);
});
