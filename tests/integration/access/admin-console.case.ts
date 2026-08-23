import assert from "node:assert/strict";

import {
  asRecord,
  callAction,
  database,
  expectActionError,
  integrationTest,
  refreshActor,
  requestId,
  seedActor,
} from "../helpers.ts";

integrationTest("admin console restriction and overview actions", async () => {
  const admin = await seedActor("console-admin", { roles: ["platform-admin"] });
  const user = await seedActor("console-user");
  const target = await seedActor("console-target");

  const { data: deletionJob, error: deletionJobError } = await database
    .table("app_private", "deletion_jobs")
    .insert({
      attempt_count: 8,
      cloudinary_public_id: `integration/deletion-${crypto.randomUUID()}`,
      error_trace_id: crypto.randomUUID(),
      status: "failed",
      target_id: target.auth.uid,
      target_type: "avatar",
    })
    .select("id")
    .single();
  if (deletionJobError) throw deletionJobError;

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
    () => callAction("listDeletionJobs", {}, user.auth),
  );
  await expectActionError(
    "permission-denied",
    () => callAction("retryDeletionJob", {
      jobId: deletionJob.id,
      requestId: requestId("retry-deletion-denied"),
    }, user.auth),
  );
  await expectActionError(
    "permission-denied",
    () => callAction("setUserRestriction", {
      uid: target.auth.uid,
      mode: "7d",
      reason: "denied",
      requestId: requestId("restrict-user-denied"),
    }, user.auth),
  );

  const users = asRecord(await callAction(
    "listAdminUsers",
    { query: target.auth.uid },
    admin.auth,
  ));
  assert.equal(
    (users.users as Array<{ uid: string }>)[0]?.uid,
    target.auth.uid,
  );
  const adminUsers = asRecord(await callAction(
    "listAdminUsers",
    { query: admin.auth.uid },
    admin.auth,
  ));
  const listedAdmin = (adminUsers.users as Array<{ roles: string[]; uid: string }>)[0];
  assert.equal(listedAdmin?.uid, admin.auth.uid);
  assert.ok(listedAdmin?.roles.includes("platform-admin"));

  const failedDeletionJobs = asRecord(await callAction("listDeletionJobs", {}, admin.auth));
  assert.equal(
    (failedDeletionJobs.entries as Array<{ id: string }>).some((entry) => entry.id === deletionJob.id),
    true,
  );
  const retriedDeletion = asRecord(await callAction("retryDeletionJob", {
    jobId: deletionJob.id,
    requestId: requestId("retry-deletion"),
  }, admin.auth));
  assert.equal(retriedDeletion.status, "pending");
  const { data: queuedDeletion, error: queuedDeletionError } = await database
    .table("app_private", "deletion_jobs")
    .select("attempt_count,error_trace_id,status")
    .eq("id", deletionJob.id)
    .single();
  if (queuedDeletionError) throw queuedDeletionError;
  assert.equal(queuedDeletion.status, "pending");
  assert.equal(queuedDeletion.attempt_count, 0);
  assert.equal(queuedDeletion.error_trace_id, null);

  await expectActionError(
    "permission-denied",
    () => callAction("setUserRestriction", {
      uid: admin.auth.uid,
      mode: "permanent",
      reason: "cannot restrict platform admins",
      requestId: requestId("restrict-platform-admin"),
    }, admin.auth),
  );

  await callAction("setUserRestriction", {
    uid: target.auth.uid,
    mode: "7d",
    reason: "integration test",
    requestId: requestId("restrict-user"),
  }, admin.auth);

  const restricted = await refreshActor(target);
  assert.equal(restricted.auth.interactionRestricted, true);

  await expectActionError(
    "user-muted",
    () => callAction("createIssue", {
      title: "blocked",
      content: "blocked",
      category: "public-issues",
      requestId: requestId("restricted-create"),
    }, restricted.auth),
  );

  const announcements = await callAction("listAnnouncements", {}, restricted.auth);
  assert.ok(announcements);

  await callAction("setUserRestriction", {
    uid: target.auth.uid,
    mode: "clear",
    reason: "",
    requestId: requestId("clear-restriction"),
  }, admin.auth);

  const restored = await refreshActor(target);
  assert.equal(restored.auth.interactionRestricted, false);

  const overviewBeforeAging = asRecord(await callAction(
    "getAdminOverview",
    { window: "24h" },
    admin.auth,
  ));
  const activityBeforeAging = overviewBeforeAging.recentActivity as Array<{
    kind: string;
    target_id: string;
  }>;
  assert.equal(
    activityBeforeAging.some(
      (entry) => entry.kind === "admin" && entry.target_id === target.auth.uid,
    ),
    true,
  );
  const activityPage = asRecord(await callAction(
    "listAdminActivity",
    { cursor: null, window: "24h" },
    admin.auth,
  ));
  assert.equal(
    (activityPage.entries as Array<{ kind: string; target_id: string }>).some(
      (entry) => entry.kind === "admin" && entry.target_id === target.auth.uid,
    ),
    true,
  );

  const { data: queuedAuditEvents, error: queuedAuditError } = await database
    .table("app_private", "outbox_events")
    .select("payload")
    .eq("event_type", "admin.audit_recorded");
  if (queuedAuditError) throw queuedAuditError;
  assert.ok((queuedAuditEvents ?? []).filter(
    (event) => asRecord(event.payload).target_id === target.auth.uid,
  ).length >= 2);

  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const { error: ageAuditError } = await database.table("app_private", "admin_audit_log")
    .update({ created_at: twoDaysAgo })
    .eq("target_id", target.auth.uid);
  if (ageAuditError) throw ageAuditError;

  const overview = asRecord(await callAction(
    "getAdminOverview",
    { window: "24h" },
    admin.auth,
  ));
  assert.ok(Number(overview.totalUsers) >= 3);
  assert.ok(Number(overview.activeUsers24h) >= 0);
  const activity24h = overview.recentActivity as Array<{ kind: string; target_id: string }>;
  assert.equal(
    activity24h.some((entry) => entry.kind === "admin" && entry.target_id === target.auth.uid),
    false,
  );
  const activity7d = asRecord(await callAction(
    "listAdminActivity",
    { cursor: null, window: "7d" },
    admin.auth,
  ));
  assert.equal(
    (activity7d.entries as Array<{ kind: string; target_id: string }>).some(
      (entry) => entry.kind === "admin" && entry.target_id === target.auth.uid,
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
