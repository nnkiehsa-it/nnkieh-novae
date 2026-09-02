import assert from "node:assert/strict";
import { processJobMessage } from "../../cloudflare/src/backend/jobs/consumer.ts";
import {
  asRecord,
  callAction,
  integrationTest,
  processPlatformJobs,
  seedActor,
  database,
  testEnvironment,
  tableRow,
} from "./helpers.ts";

const DAY_MS = 86_400_000;

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for local integration tests.`);
  return value;
}

async function expectPresent(table: Parameters<typeof tableRow>[0], column: string, value: string) {
  assert.ok(await tableRow(table, column, value), `${table}.${column}=${value} should be retained`);
}

async function expectRemoved(table: Parameters<typeof tableRow>[0], column: string, value: string) {
  assert.equal(await tableRow(table, column, value), null, `${table}.${column}=${value} should be removed`);
}

integrationTest("configured retention cleanup removes every expired data class and preserves fresh rows", async () => {
  const runId = crypto.randomUUID();
  const expiredAt = new Date(Date.now() - 4_000 * DAY_MS).toISOString();
  const recentAt = new Date(Date.now() - 60_000).toISOString();
  const futureAt = new Date(Date.now() + DAY_MS).toISOString();
  const admin = await seedActor(`retention-admin-${runId}`, { roles: ["platform-admin"] });
  const owner = await seedActor(`retention-owner-${runId}`);
  const avatarOwner = await seedActor(`retention-avatar-${runId}`);
  const staleAvatarOwner = await seedActor(`retention-stale-avatar-${runId}`);

  const { data: issueCategories, error: issueCategoryError } = await database.table("app_private", "issue_categories").select("id").eq("is_active", true).order("sort_order");
  if (issueCategoryError) throw issueCategoryError;
  const { data: facilityCategories, error: facilityCategoryError } = await database.table("app_private", "facility_categories").select("id").eq("is_active", true).order("sort_order");
  if (facilityCategoryError) throw facilityCategoryError;
  const issueCategoryIds = (issueCategories ?? []).map((row) => String(row.id));
  const facilityCategoryId = String(facilityCategories?.[0]?.id ?? "");
  assert.ok(issueCategoryIds.length > 0);
  assert.ok(facilityCategoryId);

  const createClosedIssue = async (label: string, closedAt: string) => {
    const created = asRecord(await callAction("createIssue", {
      category: issueCategoryIds[0],
      content: `Retention ${label} issue content`,
      title: `Retention ${label} issue`,
    }, owner.auth));
    const id = String(asRecord(created.issue).id);
    const { error } = await database.table("app_private", "issues").update({
      closed_at: closedAt,
      status: "completed",
    }).eq("id", id);
    if (error) throw error;
    return id;
  };
  const createClosedFacility = async (label: string, closedAt: string) => {
    const created = asRecord(await callAction("createFacility", {
      categoryId: facilityCategoryId,
      content: `Retention ${label} facility content`,
      location: "Retention room",
      title: `Retention ${label} facility`,
    }, owner.auth));
    const id = String(asRecord(created.facility).id);
    const { error } = await database.table("app_private", "facility_reports").update({
      closed_at: closedAt,
      status: "completed",
    }).eq("id", id);
    if (error) throw error;
    return id;
  };

  const expiredIssueId = await createClosedIssue("expired", expiredAt);
  const recentIssueId = await createClosedIssue("recent", recentAt);
  const expiredFacilityId = await createClosedFacility("expired", expiredAt);
  const recentFacilityId = await createClosedFacility("recent", recentAt);

  const expiredAnnouncementId = crypto.randomUUID();
  const recentAnnouncementId = crypto.randomUUID();
  const { error: announcementError } = await database.table("app_private", "announcements").insert([
    { author_uid: admin.auth.uid, content: "Expired retention announcement", id: expiredAnnouncementId, published_at: expiredAt, title: "Expired announcement" },
    { author_uid: admin.auth.uid, content: "Recent retention announcement", id: recentAnnouncementId, published_at: recentAt, title: "Recent announcement" },
  ]);
  if (announcementError) throw announcementError;
  const { error: notionError } = await database.table("app_private", "notion_pages").insert([
    { notion_page_id: `notion-issue-${runId}`, target_id: expiredIssueId, target_type: "issue" },
    { notion_page_id: `notion-facility-${runId}`, target_id: expiredFacilityId, target_type: "facility" },
  ]);
  if (notionError) throw notionError;

  const expiredNotificationId = crypto.randomUUID();
  const recentNotificationId = crypto.randomUUID();
  const { error: notificationError } = await database.table("app_private", "notifications").insert([
    {
      created_at: expiredAt,
      expires_at: futureAt,
      id: expiredNotificationId,
      recipient_uid: owner.auth.uid,
      source: "user",
      target_id: `retention-expired-${runId}`,
      target_type: "issue",
      title: "Expired retention notification",
      type: "integration_retention",
    },
    {
      created_at: recentAt,
      expires_at: expiredAt,
      id: recentNotificationId,
      recipient_uid: owner.auth.uid,
      source: "user",
      target_id: `retention-recent-${runId}`,
      target_type: "issue",
      title: "Recent retention notification",
      type: "integration_retention",
    },
  ]);
  if (notificationError) throw notificationError;

  const operationIds = { expired: crypto.randomUUID(), recent: crypto.randomUUID() };
  const { error: opError } = await database.table("app_private", "operations").insert([
    {
      operation_id: operationIds.expired,
      action: "createIssue",
      actor_uid: owner.auth.uid,
      response: { seeded: true },
      status: "completed",
      expires_at: expiredAt,
      created_at: expiredAt,
      updated_at: expiredAt,
    },
    {
      operation_id: operationIds.recent,
      action: "createIssue",
      actor_uid: owner.auth.uid,
      response: { seeded: true },
      status: "completed",
      expires_at: futureAt,
      created_at: recentAt,
      updated_at: recentAt,
    },
  ]);
  if (opError) throw opError;

  const eventIds = { expired: crypto.randomUUID(), recent: crypto.randomUUID() };
  const { error: eventError } = await database.table("app_private", "domain_events").insert([
    {
      actor_uid: owner.auth.uid,
      aggregate_id: `expired-${runId}`,
      aggregate_type: "issue",
      event_id: eventIds.expired,
      event_type: "issue.deleted",
      occurred_at: expiredAt,
      operation_id: operationIds.expired,
      payload: { retention_cleanup: true },
    },
    {
      actor_uid: owner.auth.uid,
      aggregate_id: `recent-${runId}`,
      aggregate_type: "issue",
      event_id: eventIds.recent,
      event_type: "issue.deleted",
      occurred_at: recentAt,
      operation_id: operationIds.recent,
      payload: { retention_cleanup: true },
    },
  ]);
  if (eventError) throw eventError;

  const deliveryIds = {
    expiredCompleted: crypto.randomUUID(),
    expiredFailed: crypto.randomUUID(),
    recentCompleted: crypto.randomUUID(),
    recentFailed: crypto.randomUUID(),
  };
  const { error: deliveryError } = await database.table("app_private", "event_deliveries").insert([
    {
      attempt_count: 1,
      created_at: expiredAt,
      destination: "notion",
      expires_at: expiredAt,
      id: deliveryIds.expiredCompleted,
      event_id: eventIds.expired,
      completed_at: expiredAt,
      last_attempt_id: crypto.randomUUID(),
      status: "completed",
      updated_at: expiredAt,
    },
    {
      attempt_count: 8,
      created_at: expiredAt,
      destination: "push",
      expires_at: expiredAt,
      id: deliveryIds.expiredFailed,
      event_id: eventIds.expired,
      error_detail: { code: "expired-failure" },
      last_attempt_id: crypto.randomUUID(),
      status: "failed",
      updated_at: expiredAt,
    },
    {
      attempt_count: 1,
      created_at: recentAt,
      destination: "notion",
      expires_at: futureAt,
      id: deliveryIds.recentCompleted,
      event_id: eventIds.recent,
      completed_at: recentAt,
      last_attempt_id: crypto.randomUUID(),
      status: "completed",
      updated_at: recentAt,
    },
    {
      attempt_count: 1,
      created_at: recentAt,
      destination: "push",
      expires_at: futureAt,
      id: deliveryIds.recentFailed,
      event_id: eventIds.recent,
      error_detail: { code: "recent-failure" },
      last_attempt_id: crypto.randomUUID(),
      status: "failed",
      updated_at: recentAt,
    },
  ]);
  if (deliveryError) throw deliveryError;

  const tokenDevices = { denied: `denied-${runId}`, expired: `expired-${runId}`, recent: `recent-${runId}` };
  const { error: tokenError } = await database.table("app_private", "push_tokens").insert([
    { device_id: tokenDevices.expired, last_confirmed_at: expiredAt, permission: "granted", platform: "integration", token: `expired-${runId}`, uid: owner.auth.uid, updated_at: recentAt, user_agent: "retention" },
    { device_id: tokenDevices.denied, last_confirmed_at: recentAt, permission: "denied", platform: "integration", token: `denied-${runId}`, uid: owner.auth.uid, updated_at: recentAt, user_agent: "retention" },
    { device_id: tokenDevices.recent, last_confirmed_at: recentAt, permission: "granted", platform: "integration", token: `recent-${runId}`, uid: owner.auth.uid, updated_at: expiredAt, user_agent: "retention" },
  ]);
  if (tokenError) throw tokenError;

  const bgJobIds = {
    expiredCompleted: crypto.randomUUID(),
    expiredFailed: crypto.randomUUID(),
    recentCompleted: crypto.randomUUID(),
    recentFailed: crypto.randomUUID(),
  };
  const { error: bgJobError } = await database.table("app_private", "background_jobs").insert([
    {
      attempt_count: 1,
      created_at: expiredAt,
      expires_at: expiredAt,
      id: bgJobIds.expiredCompleted,
      job_type: "deletion",
      payload: { target_id: `expired-completed-${runId}` },
      scope_id: `expired-completed-${runId}`,
      completed_at: expiredAt,
      status: "completed",
      updated_at: expiredAt,
    },
    {
      attempt_count: 8,
      created_at: expiredAt,
      expires_at: expiredAt,
      id: bgJobIds.expiredFailed,
      job_type: "deletion",
      payload: { target_id: `expired-failed-${runId}` },
      scope_id: `expired-failed-${runId}`,
      error_detail: { code: "expired-failure" },
      last_attempt_id: crypto.randomUUID(),
      status: "failed",
      updated_at: expiredAt,
    },
    {
      attempt_count: 1,
      created_at: recentAt,
      expires_at: futureAt,
      id: bgJobIds.recentCompleted,
      job_type: "deletion",
      payload: { target_id: `recent-completed-${runId}` },
      scope_id: `recent-completed-${runId}`,
      completed_at: recentAt,
      status: "completed",
      updated_at: recentAt,
    },
    {
      attempt_count: 1,
      created_at: recentAt,
      expires_at: futureAt,
      id: bgJobIds.recentFailed,
      job_type: "deletion",
      payload: { target_id: `recent-failed-${runId}` },
      scope_id: `recent-failed-${runId}`,
      error_detail: { code: "recent-failure" },
      last_attempt_id: crypto.randomUUID(),
      status: "failed",
      updated_at: recentAt,
    },
  ]);
  if (bgJobError) throw bgJobError;

  const auditUids = { expired: `audit-expired-${runId}`, recent: `audit-recent-${runId}` };
  const { error: auditError } = await database.table("app_private", "role_assignment_audit").insert([
    { actor_uid: admin.auth.uid, created_at: expiredAt, operation: "grant", role_code: "announcement-manager", uid: auditUids.expired },
    { actor_uid: admin.auth.uid, created_at: recentAt, operation: "grant", role_code: "announcement-manager", uid: auditUids.recent },
  ]);
  if (auditError) throw auditError;
  const adminAuditTargets = {
    expired: `admin-audit-expired-${runId}`,
    recent: `admin-audit-recent-${runId}`,
  };
  const { error: adminAuditError } = await database.table("app_private", "admin_audit_log").insert([
    { action: "retention-test", actor_uid: admin.auth.uid, created_at: expiredAt, domain: "test", target_id: adminAuditTargets.expired },
    { action: "retention-test", actor_uid: admin.auth.uid, created_at: recentAt, domain: "test", target_id: adminAuditTargets.recent },
  ]);
  if (adminAuditError) throw adminAuditError;
  const { data: expiredAdminAudit, error: expiredAdminAuditError } = await database
    .table("app_private", "admin_audit_log")
    .select("id")
    .eq("target_id", adminAuditTargets.expired)
    .single();
  if (expiredAdminAuditError) throw expiredAdminAuditError;
  const orphanedNotionTargets = {
    admin: String(expiredAdminAudit.id),
    announcement: expiredAnnouncementId,
  };
  const { error: orphanedNotionError } = await database.table("app_private", "notion_pages").insert([
    { notion_page_id: `notion-admin-${runId}`, target_id: orphanedNotionTargets.admin, target_type: "admin-audit" },
    { notion_page_id: `notion-announcement-${runId}`, target_id: orphanedNotionTargets.announcement, target_type: "announcement" },
  ]);
  if (orphanedNotionError) throw orphanedNotionError;

  const categoryAuditTargets = { expired: `category-expired-${runId}`, recent: `category-recent-${runId}` };
  const { error: categoryAuditError } = await database.table("app_private", "category_configuration_audit").insert([
    { actor_uid: admin.auth.uid, category_id: categoryAuditTargets.expired, created_at: expiredAt, domain: "issue", operation: "update" },
    { actor_uid: admin.auth.uid, category_id: categoryAuditTargets.recent, created_at: recentAt, domain: "issue", operation: "update" },
  ]);
  if (categoryAuditError) throw categoryAuditError;

  const accessAuditTargets = { expired: `access-expired-${runId}`, recent: `access-recent-${runId}` };
  const { error: accessAuditError } = await database.table("app_private", "access_assignment_audit").insert([
    { actor_uid: admin.auth.uid, after_value: {}, before_value: {}, created_at: expiredAt, target_uid: accessAuditTargets.expired },
    { actor_uid: admin.auth.uid, after_value: {}, before_value: {}, created_at: recentAt, target_uid: accessAuditTargets.recent },
  ]);
  if (accessAuditError) throw accessAuditError;

  const staleAvatarPublicId = `srp/avatars/${staleAvatarOwner.auth.uid}_stale`;
  const referencedAvatarPublicId = `srp/avatars/${owner.auth.uid}_referenced`;
  const { error: staleProfilesError } = await database.table("app_private", "user_profiles").update({
    avatar_hash: "stale-avatar-hash",
    avatar_public_id: staleAvatarPublicId,
    avatar_source_url: "https://example.test/stale-avatar",
    cached_photo_url: "https://example.test/stale-avatar-cache",
    last_seen_at: expiredAt,
    photo_url: "https://example.test/stale-avatar-source",
  }).eq("uid", staleAvatarOwner.auth.uid);
  if (staleProfilesError) throw staleProfilesError;
  const { error: referencedProfileError } = await database.table("app_private", "user_profiles").update({
    avatar_public_id: referencedAvatarPublicId,
    last_seen_at: expiredAt,
  }).eq("uid", owner.auth.uid);
  if (referencedProfileError) throw referencedProfileError;
  const { error: staleAdminError } = await database.table("app_private", "user_profiles")
    .update({ last_seen_at: expiredAt }).eq("uid", admin.auth.uid);
  if (staleAdminError) throw staleAdminError;

  const { error: restrictionError } = await database.table("app_private", "user_restrictions").insert([
    { reason: "expired retention restriction", restricted_until: expiredAt, uid: staleAvatarOwner.auth.uid, updated_by: admin.auth.uid },
    { reason: "recent retention restriction", restricted_until: futureAt, uid: owner.auth.uid, updated_by: admin.auth.uid },
  ]);
  if (restrictionError) throw restrictionError;

  const uploadIds = {
    attached: crypto.randomUUID(),
    failed: crypto.randomUUID(),
    pending: crypto.randomUUID(),
    readyUnattached: crypto.randomUUID(),
    recentPending: crypto.randomUUID(),
  };
  const upload = (id: string, status: string, timestamp: string, attached = false) => ({
    attached_target_id: attached ? crypto.randomUUID() : null,
    attached_target_type: attached ? "issue" : null,
    cloudinary_public_id: `retention/${id}`,
    created_at: timestamp,
    id,
    owner_uid: owner.auth.uid,
    status,
    updated_at: timestamp,
    visibility: "authenticated",
  });
  const { error: uploadError } = await database.table("app_private", "uploads").insert([
    upload(uploadIds.pending, "pending", expiredAt),
    upload(uploadIds.readyUnattached, "ready", expiredAt),
    upload(uploadIds.failed, "failed", expiredAt),
    upload(uploadIds.recentPending, "pending", recentAt),
    upload(uploadIds.attached, "ready", recentAt, true),
  ]);
  if (uploadError) throw uploadError;

  const management = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  const platformSettings = asRecord(management.platformSettings);
  await callAction("savePlatformSettings", {
    imageUploads: asRecord(platformSettings.imageUploads),
    retention: asRecord(platformSettings.retention),
  }, admin.auth);
  await processPlatformJobs(500);

  await expectRemoved("issues", "id", expiredIssueId);
  await expectPresent("issues", "id", recentIssueId);
  await expectRemoved("facility_reports", "id", expiredFacilityId);
  await expectPresent("facility_reports", "id", recentFacilityId);
  await expectRemoved("announcements", "id", expiredAnnouncementId);
  await expectPresent("announcements", "id", recentAnnouncementId);
  await expectRemoved("notifications", "id", expiredNotificationId);
  await expectPresent("notifications", "id", recentNotificationId);
  await expectPresent("operations", "operation_id", operationIds.expired);
  await expectPresent("operations", "operation_id", operationIds.recent);
  await expectRemoved("event_deliveries", "id", deliveryIds.expiredCompleted);
  await expectRemoved("event_deliveries", "id", deliveryIds.expiredFailed);
  await expectPresent("event_deliveries", "id", deliveryIds.recentCompleted);
  await expectPresent("event_deliveries", "id", deliveryIds.recentFailed);
  await expectRemoved("push_tokens", "device_id", tokenDevices.expired);
  await expectRemoved("push_tokens", "device_id", tokenDevices.denied);
  await expectPresent("push_tokens", "device_id", tokenDevices.recent);
  await expectRemoved("background_jobs", "id", bgJobIds.expiredCompleted);
  await expectRemoved("background_jobs", "id", bgJobIds.expiredFailed);
  await expectPresent("background_jobs", "id", bgJobIds.recentCompleted);
  await expectPresent("background_jobs", "id", bgJobIds.recentFailed);
  await expectRemoved("role_assignment_audit", "uid", auditUids.expired);
  await expectPresent("role_assignment_audit", "uid", auditUids.recent);
  await expectRemoved("admin_audit_log", "target_id", adminAuditTargets.expired);
  await expectPresent("admin_audit_log", "target_id", adminAuditTargets.recent);
  await expectRemoved("category_configuration_audit", "category_id", categoryAuditTargets.expired);
  await expectPresent("category_configuration_audit", "category_id", categoryAuditTargets.recent);
  await expectRemoved("access_assignment_audit", "target_uid", accessAuditTargets.expired);
  await expectPresent("access_assignment_audit", "target_uid", accessAuditTargets.recent);
  await expectRemoved("notion_pages", "target_id", orphanedNotionTargets.admin);
  await expectRemoved("notion_pages", "target_id", orphanedNotionTargets.announcement);
  await expectRemoved("user_restrictions", "uid", staleAvatarOwner.auth.uid);
  await expectPresent("user_restrictions", "uid", owner.auth.uid);
  await expectRemoved("uploads", "id", uploadIds.pending);
  await expectRemoved("uploads", "id", uploadIds.readyUnattached);
  await expectRemoved("uploads", "id", uploadIds.failed);
  await expectPresent("uploads", "id", uploadIds.recentPending);
  await expectPresent("uploads", "id", uploadIds.attached);
  for (const id of [uploadIds.pending, uploadIds.readyUnattached, uploadIds.failed]) {
    await expectPresent("background_jobs", "scope_id", id);
  }

  const staleAvatarProfile = await tableRow("user_profiles", "uid", staleAvatarOwner.auth.uid);
  assert.equal(staleAvatarProfile?.avatar_public_id, null);
  assert.equal(staleAvatarProfile?.display_name, null);
  assert.equal(staleAvatarProfile?.email, null);
  const referencedAvatarProfile = await tableRow("user_profiles", "uid", owner.auth.uid);
  assert.equal(referencedAvatarProfile?.avatar_public_id, referencedAvatarPublicId);
  assert.notEqual(referencedAvatarProfile?.display_name, null);
  const adminProfile = await tableRow("user_profiles", "uid", admin.auth.uid);
  assert.notEqual(adminProfile?.email, null, "assigned administrators must not be PII-minimized automatically");
  await expectPresent("background_jobs", "scope_id", staleAvatarOwner.auth.uid);

  const { data: retentionEvents, error: retentionEventError } = await database.table("app_private", "domain_events").select("event_type,payload,aggregate_id")
    .in("aggregate_id", [expiredIssueId, expiredFacilityId]);
  if (retentionEventError) throw retentionEventError;
  const scheduledDeletionEvents = (retentionEvents ?? []).filter((event: any) =>
    asRecord(event.payload).retention_cleanup === true
  );
  assert.equal(scheduledDeletionEvents.length, 2);
  assert.deepEqual(
    new Set(scheduledDeletionEvents.map((event: any) => event.event_type)),
    new Set(["issue.deleted", "facility.deleted"]),
  );
  const { count: retentionNotificationCount, error: retentionNotificationError } = await database
    .table("app_private", "notifications").select("id", { count: "exact", head: true })
    .in("target_id", [expiredIssueId, expiredFacilityId]);
  if (retentionNotificationError) throw retentionNotificationError;
  assert.equal(retentionNotificationCount, 0, "scheduled retention deletion must not notify users");

  const staleUploadIds = [uploadIds.pending, uploadIds.readyUnattached, uploadIds.failed];
  const currentAvatarPublicId = `srp/avatars/${avatarOwner.auth.uid}_current`;
  const oldAvatarPublicId = `srp/avatars/${owner.auth.uid}_old`;
  const { error: avatarProfileError } = await database.table("app_private", "user_profiles")
    .update({ avatar_public_id: currentAvatarPublicId }).eq("uid", avatarOwner.auth.uid);
  if (avatarProfileError) throw avatarProfileError;
  const { error: avatarJobsError } = await database.table("app_private", "background_jobs").insert([
    {
      attempt_count: 0,
      id: crypto.randomUUID(),
      job_type: "deletion",
      payload: {
        cloudinary_public_id: currentAvatarPublicId,
        target_id: avatarOwner.auth.uid,
        target_type: "avatar",
      },
      scope_id: avatarOwner.auth.uid,
      status: "pending",
    },
    {
      attempt_count: 0,
      id: crypto.randomUUID(),
      job_type: "deletion",
      payload: {
        cloudinary_public_id: oldAvatarPublicId,
        target_id: owner.auth.uid,
        target_type: "avatar",
      },
      scope_id: owner.auth.uid,
      status: "pending",
    },
  ]);
  if (avatarJobsError) throw avatarJobsError;
  const deletionTargetIds = [
    ...staleUploadIds,
    avatarOwner.auth.uid,
    owner.auth.uid,
    staleAvatarOwner.auth.uid,
  ];
  let completedUploadJobs: Array<{ status: string; target_id: string }> = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await processJobMessage({ type: "drain" }, testEnvironment);
    const { data, error } = await database.table("app_private", "background_jobs")
      .select("status,scope_id").in("scope_id", deletionTargetIds);
    if (error) throw error;
    completedUploadJobs = (data ?? []).map((job: any) => ({ status: job.status, target_id: job.scope_id }));
    if (completedUploadJobs.length === deletionTargetIds.length
      && completedUploadJobs.every((job) => job.status === "completed")) break;
  }
  if (!completedUploadJobs.every((job) => job.status === "completed")) {
    console.log("[DEBUG completedUploadJobs]", JSON.stringify(completedUploadJobs));
    const { data: allPending } = await database.table("app_private", "background_jobs").select("*").in("scope_id", deletionTargetIds);
    console.log("[DEBUG allPending]", JSON.stringify(allPending));
  }
  assert.equal(completedUploadJobs.length, deletionTargetIds.length);
  assert.ok(completedUploadJobs.every((job) => job.status === "completed"));

  const providerUrl = requiredEnv("FCM_EMULATOR_URL").replace("host.docker.internal", "127.0.0.1");
  const providerResponse = await fetch(`${providerUrl}/__requests`);
  assert.equal(providerResponse.status, 200);
  const providerRequests = (await providerResponse.json()) as {
    requests: Array<{ body: Record<string, unknown>; path: string }>;
  };
  const destroyedPublicIds = new Set(providerRequests.requests
    .filter((request) => request.path.endsWith("/image/destroy"))
    .map((request) => String(request.body.public_id)));
  for (const id of staleUploadIds) assert.ok(destroyedPublicIds.has(`retention/${id}`));
  assert.ok(destroyedPublicIds.has(oldAvatarPublicId), "superseded avatar must be deleted");
  assert.ok(destroyedPublicIds.has(staleAvatarPublicId), "unreferenced inactive avatar must be deleted");
  assert.equal(destroyedPublicIds.has(currentAvatarPublicId), false, "current avatar must never be deleted");

  const maintenance = await processJobMessage({ type: "maintenance" }, testEnvironment);
  assert.ok(maintenance.backgroundJobs.processedCount >= 0);
  const { count: postWorkerDeletionNotificationCount, error: postWorkerNotificationError } = await database
    .table("app_private", "notifications").select("id", { count: "exact", head: true })
    .eq("target_id", expiredIssueId)
    .eq("type", "issue_deleted");
  if (postWorkerNotificationError) throw postWorkerNotificationError;
  assert.equal(postWorkerDeletionNotificationCount, 0, "retention deletion must stay silent after outbox processing");
  let retainedNotionMappings: number | null = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { count, error: retainedNotionMappingError } = await database
      .table("app_private", "notion_pages").select("target_id", { count: "exact", head: true })
      .in("target_id", [expiredIssueId, expiredFacilityId]);
    if (retainedNotionMappingError) throw retainedNotionMappingError;
    retainedNotionMappings = count ?? null;
    if (count === 0) break;
    await processJobMessage({ type: "drain" }, testEnvironment);
  }
  assert.equal(retainedNotionMappings, 0, "retention cleanup should forget local Notion mappings");

  const postMaintenanceProviderResponse = await fetch(`${providerUrl}/__requests`);
  assert.equal(postMaintenanceProviderResponse.status, 200);
  const postMaintenanceProviderRequests = (await postMaintenanceProviderResponse.json()) as {
    requests: Array<{ body: Record<string, unknown>; path: string }>;
  };
  const retainedNotionPageIds = [`notion-issue-${runId}`, `notion-facility-${runId}`];
  assert.equal(
    postMaintenanceProviderRequests.requests.some((request) =>
      retainedNotionPageIds.some((pageId) => request.path.includes(`/pages/${pageId}`))
    ),
    false,
    "retention cleanup must leave the Notion archive pages untouched",
  );
});

integrationTest("closed-content retention can be disabled without disabling other maintenance", async () => {
  const runId = crypto.randomUUID();
  const expiredAt = new Date(Date.now() - 4_000 * DAY_MS).toISOString();
  const admin = await seedActor(`retention-disabled-admin-${runId}`, { roles: ["platform-admin"] });
  const owner = await seedActor(`retention-disabled-owner-${runId}`);
  const { data: categories, error: categoryError } = await database.table("app_private", "issue_categories")
    .select("id").eq("is_active", true).order("sort_order").limit(1);
  if (categoryError) throw categoryError;
  const category = String(categories?.[0]?.id ?? "");
  assert.ok(category);
  const created = asRecord(await callAction("createIssue", {
    category,
    content: "A closed proposal retained by the disabled cleanup policy.",
    title: "Retention disabled",
  }, owner.auth));
  const issueId = String(asRecord(created.issue).id);
  const { error: closeError } = await database.table("app_private", "issues")
    .update({ closed_at: expiredAt, status: "completed" }).eq("id", issueId);
  if (closeError) throw closeError;
  const management = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  const platformSettings = asRecord(management.platformSettings);
  await callAction("savePlatformSettings", {
    imageUploads: asRecord(platformSettings.imageUploads),
    retention: {
      ...asRecord(platformSettings.retention),
      closedFacilitiesEnabled: false,
      closedIssuesEnabled: false,
    },
  }, admin.auth);
  await processPlatformJobs();
  await expectPresent("issues", "id", issueId);
  await callAction("savePlatformSettings", {
    imageUploads: asRecord(platformSettings.imageUploads),
    retention: asRecord(platformSettings.retention),
  }, admin.auth);
  await processPlatformJobs();
});
