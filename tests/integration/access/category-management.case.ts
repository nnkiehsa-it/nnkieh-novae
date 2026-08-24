import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  expectActionError,
  insertReadyUpload,
  integrationTest,
  refreshActor,
  requestId,
  saveCategoryDraft,
  seedActor,
  database,
  tableRow,
} from "../helpers.ts";

integrationTest("runtime category setup and management enforce platform permissions and immutable privacy", async () => {
  const admin = await seedActor("category-admin", { roles: ["platform-admin"] });
  const user = await seedActor("category-user");

  const catalog = asRecord(await callAction("getCategoryCatalog", {}, user.auth));
  assert.ok((catalog.issueCategories as unknown[]).length >= 2);
  assert.ok((catalog.facilityCategories as unknown[]).length >= 1);
  assert.deepEqual(asRecord(catalog.features), {
    announcementCommentsEnabled: true,
    facilitiesEnabled: true,
    issuesEnabled: true,
  });
  await expectActionError("permission-denied", () => callAction("getCategoryManagement", {}, user.auth));
  await expectActionError("permission-denied", () => callAction("listPlatformJobs", {}, user.auth));
  await expectActionError("permission-denied", () => callAction("estimateCategoryPolicyChanges", {
    announcementCommentsEnabled: false,
    deletedIssueCategoryIds: [],
    issueCategories: [],
  }, user.auth));
  await expectActionError("permission-denied", () => callAction("estimateRetentionCleanup", {
    imageUploads: {},
    retention: {},
  }, user.auth));
  await expectActionError("permission-denied", () => callAction("completeInitialSetup", {
    facilitiesEnabled: false, facilityCategories: [], issuesEnabled: false,
    issueCategories: [], requestId: requestId("setup-denied"),
  }, user.auth));
  await expectActionError("permission-denied", () => callAction("savePlatformFeatures", {
    announcementCommentsEnabled: true,
    facilitiesEnabled: false, issuesEnabled: false, requestId: requestId("features-denied"),
  }, user.auth));
  await expectActionError("permission-denied", () => callAction("savePlatformSettings", {
    imageUploads: {
      announcementMaxImages: 10, commentMaxImages: 1, facilityMaxImages: 2, issueMaxImages: 3,
      maxDimension: 2000, maxUploadKilobytes: 800, webpQuality: 0.82,
    },
    retention: {
      closedFacilitiesDays: 180, closedFacilitiesEnabled: false,
      closedIssuesDays: 180, closedIssuesEnabled: false,
    },
    requestId: requestId("platform-settings-denied"),
  }, user.auth));

  const setup = asRecord(await callAction("completeInitialSetup", {
    issueCategories: [
      {
        id: "public-issues", label: "公共議題", readAccess: "reviewed-school",
        authorVisible: false, supportEnabled: true, supportGoal: 50, supportDeadlineDays: 14,
        responseDeadlineDays: 7, commentsEnabled: true,
      },
      {
        id: "rights-maintenance", label: "學生權益", readAccess: "owner-admin",
        authorVisible: true, supportEnabled: false, supportGoal: null, supportDeadlineDays: null,
        responseDeadlineDays: 7, commentsEnabled: true,
      },
    ],
    facilitiesEnabled: false,
    facilityCategories: [],
    issuesEnabled: true,
    requestId: requestId("complete-setup"),
  }, admin.auth));
  assert.equal(setup.success, true);
  assert.equal(setup.facilitiesEnabled, false);
  const repeatedSetup = asRecord(await callAction("completeInitialSetup", {
    issueCategories: [],
    facilityCategories: [],
    requestId: requestId("complete-setup-repeat"),
  }, admin.auth));
  assert.equal(repeatedSetup.success, true);
  assert.equal(repeatedSetup.setupCompleted, true);

  const management = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  assert.deepEqual(asRecord(management.features), {
    announcementCommentsEnabled: true,
    facilitiesEnabled: false,
    issuesEnabled: true,
  });
  const platformSettings = asRecord(management.platformSettings);
  assert.equal("maxSourceMegabytes" in asRecord(platformSettings.imageUploads), false);
  const { data: retainedAnnouncement, error: retainedAnnouncementError } = await database
    .table("app_private", "announcements")
    .insert({
      author_uid: admin.auth.uid,
      content: "Retention batch integration test",
      published_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      title: "Retention batch",
    })
    .select("id")
    .single();
  if (retainedAnnouncementError) throw retainedAnnouncementError;
  const nextPlatformSettings = {
    imageUploads: {
      ...asRecord(platformSettings.imageUploads),
      issueMaxImages: 3,
    },
    retention: {
      ...asRecord(platformSettings.retention),
      adminAuditDays: 2,
      announcementsDays: 1,
      closedFacilitiesEnabled: false,
      closedIssuesEnabled: false,
      idempotencyHours: 19,
      notificationsDays: 9,
      outboxCompletedDays: 13,
      outboxFailedDays: 17,
      pendingUploadHours: 23,
      realtimeEventsHours: 11,
      roleAssignmentAuditDays: 4,
    },
  };
  const retentionImpact = asRecord(await callAction(
    "estimateRetentionCleanup",
    nextPlatformSettings,
    admin.auth,
  ));
  assert.ok(Number(retentionImpact.totalEstimatedRows) >= 1);
  const updatedSettings = asRecord(await callAction("savePlatformSettings", {
    ...nextPlatformSettings,
    requestId: requestId("platform-settings-save"),
  }, admin.auth));
  assert.equal(asRecord(updatedSettings.imageUploads).issueMaxImages, 3);
  assert.equal(asRecord(updatedSettings.retention).closedIssuesEnabled, false);
  assert.ok(String(updatedSettings.jobId));
  const runtimeDeadlineId = crypto.randomUUID();
  const { data: runtimeNotification, error: runtimeNotificationError } = await database
    .table("app_private", "notifications")
    .insert({
      id: runtimeDeadlineId,
      recipient_uid: user.auth.uid,
      source: "user",
      target_id: runtimeDeadlineId,
      target_type: "issue",
      title: "Runtime retention deadline",
      type: "retention_runtime",
    })
    .select("created_at,expires_at")
    .single();
  if (runtimeNotificationError) throw runtimeNotificationError;
  const notificationLifetimeDays = (
    new Date(runtimeNotification.expires_at).getTime() - new Date(runtimeNotification.created_at).getTime()
  ) / 86_400_000;
  assert.ok(Math.abs(notificationLifetimeDays - 9) < 0.001, "new rows must use the saved retention immediately");
  const independentAuditAt = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const independentRoleAuditUid = `retention-role-${crypto.randomUUID()}`;
  const { error: independentRoleAuditError } = await database.table("app_private", "role_assignment_audit")
    .insert({
      actor_uid: admin.auth.uid,
      created_at: independentAuditAt,
      operation: "grant",
      role_code: "announcement-manager",
      uid: independentRoleAuditUid,
    });
  if (independentRoleAuditError) throw independentRoleAuditError;
  const independentAdminAuditTarget = `retention-admin-${crypto.randomUUID()}`;
  const { error: independentAdminAuditError } = await database.table("app_private", "admin_audit_log")
    .insert({
      action: "retention-independent",
      actor_uid: admin.auth.uid,
      created_at: independentAuditAt,
      domain: "platform",
      target_id: independentAdminAuditTarget,
    });
  if (independentAdminAuditError) throw independentAdminAuditError;
  assert.ok(await tableRow("announcements", "id", retainedAnnouncement.id));
  for (let index = 0; index < 20; index += 1) {
    const { data: batch, error: batchError } = await database.call(
      "app_api",
      "backend_process_platform_job_batch",
      { batch_size: 1 },
    );
    if (batchError) throw batchError;
    if (asRecord(batch).hasMore !== true) break;
  }
  assert.equal(await tableRow("announcements", "id", retainedAnnouncement.id), null);
  assert.ok(await tableRow("role_assignment_audit", "uid", independentRoleAuditUid));
  assert.equal(await tableRow("admin_audit_log", "target_id", independentAdminAuditTarget), null);
  const catalogWithImageSettings = asRecord(await callAction("getCategoryCatalog", {}, user.auth));
  assert.equal(asRecord(catalogWithImageSettings.imageUploads).issueMaxImages, 3);
  const uploadMetadata = Array.from({ length: 3 }, () => ({
    contentType: "image/webp", height: 64, size: 256, width: 64,
  }));
  const uploadSessions = asRecord(await callAction("createImageUploadSessions", {
    images: uploadMetadata,
    requestId: requestId("configured-image-count"),
    targetType: "issue",
  }, user.auth));
  assert.equal((uploadSessions.sessions as unknown[]).length, 3);
  await expectActionError("validation-too-many", () => callAction("createImageUploadSessions", {
    images: [...uploadMetadata, uploadMetadata[0]],
    requestId: requestId("configured-image-count-too-many"),
    targetType: "issue",
  }, user.auth));
  const sessionPaths = (uploadSessions.sessions as unknown[]).map((value) => {
    const session = asRecord(value);
    return `${String(session.folder)}/${String(session.publicId)}`;
  });
  await callAction("deleteUploadedImages", {
    requestId: requestId("configured-image-count-cleanup"), storagePaths: sessionPaths,
  }, user.auth);
  await callAction("savePlatformSettings", {
    imageUploads: asRecord(platformSettings.imageUploads),
    retention: asRecord(platformSettings.retention),
    requestId: requestId("platform-settings-restore"),
  }, admin.auth);
  const publicCategory = asRecord((management.issueCategories as unknown[])
    .find((value) => asRecord(value).id === "public-issues"));
  const savedIssue = asRecord(await saveCategoryDraft(admin.auth, {
    upsertIssueCategories: [{ ...publicCategory, label: "公共議題-修改" }],
  }));
  assert.equal(
    asRecord((savedIssue.issueCategories as unknown[])
      .find((value) => asRecord(value).id === "public-issues")).label,
    "公共議題-修改",
  );
  await expectActionError("immutable-category-policy", () => saveCategoryDraft(admin.auth, {
    upsertIssueCategories: [{ ...publicCategory, readAccess: "school" }],
  }));
  await expectActionError("permission-denied", () => callAction("saveCategoryManagement", {
    announcementCommentsEnabled: true,
    deletedFacilityCategoryIds: [],
    deletedIssueCategoryIds: [],
    facilitiesEnabled: false,
    facilityCategories: [],
    issueCategories: [publicCategory],
    issuesEnabled: true,
    requestId: requestId("save-category-denied"),
  }, user.auth));

  const savedFacility = asRecord(await saveCategoryDraft(admin.auth, {
    facilitiesEnabled: true,
    upsertFacilityCategories: [{
      id: "general", isDefault: true, label: "一般設備-修改", sortOrder: 0,
    }],
  }));
  assert.equal(
    asRecord((savedFacility.facilityCategories as unknown[])
      .find((value) => asRecord(value).id === "general")).label,
    "一般設備-修改",
  );
  const updatedCatalog = asRecord(await callAction("getCategoryCatalog", {}, user.auth));
  assert.deepEqual(asRecord(updatedCatalog.features), {
    announcementCommentsEnabled: true,
    facilitiesEnabled: true,
    issuesEnabled: true,
  });

  const managed = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  const managedIssues = (managed.issueCategories as unknown[]).map((value, index) => {
    const category = asRecord(value);
    return {
      ...category,
      label: category.id === "public-issues" ? "公共議題-原子" : category.label,
      sortOrder: index,
    };
  });
  const managedFacilities = (managed.facilityCategories as unknown[]).map((value, index) => {
    const category = asRecord(value);
    return {
      ...category,
      label: category.id === "general" ? "一般設備-原子" : category.label,
      sortOrder: index,
    };
  });
  const { data: policyAnnouncement, error: policyAnnouncementError } = await database
    .table("app_private", "announcements")
    .insert({
      author_uid: admin.auth.uid,
      content: "Background policy integration test",
      title: "Background policy",
    })
    .select("id")
    .single();
  if (policyAnnouncementError) throw policyAnnouncementError;
  const impact = asRecord(await callAction("estimateCategoryPolicyChanges", {
    announcementCommentsEnabled: false,
    deletedIssueCategoryIds: [],
    issueCategories: managedIssues,
  }, admin.auth));
  assert.ok(Number(impact.totalEstimatedRows) >= 1);
  await expectActionError("permission-denied", () => callAction("saveCategoryManagement", {
    announcementCommentsEnabled: true,
    deletedFacilityCategoryIds: [],
    deletedIssueCategoryIds: [],
    facilitiesEnabled: true,
    facilityCategories: managedFacilities,
    issueCategories: managedIssues,
    issuesEnabled: true,
    requestId: requestId("save-management-denied"),
  }, user.auth));
  await expectActionError("validation-required", () => callAction("saveCategoryManagement", {
    announcementCommentsEnabled: true,
    deletedFacilityCategoryIds: [],
    deletedIssueCategoryIds: [],
    facilitiesEnabled: true,
    facilityCategories: [],
    issueCategories: managedIssues,
    issuesEnabled: true,
    requestId: requestId("save-management-empty"),
  }, admin.auth));
  const atomicSave = asRecord(await callAction("saveCategoryManagement", {
    announcementCommentsEnabled: false,
    deletedFacilityCategoryIds: [],
    deletedIssueCategoryIds: [],
    facilitiesEnabled: true,
    facilityCategories: managedFacilities,
    issueCategories: managedIssues,
    issuesEnabled: true,
    requestId: requestId("save-management-ok"),
  }, admin.auth));
  assert.equal(atomicSave.success, true);
  const announcementBeforeBatch = await tableRow("announcements", "id", policyAnnouncement.id);
  assert.ok(announcementBeforeBatch);
  assert.equal(announcementBeforeBatch.comments_enabled, true);
  const queuedJobs = asRecord(await callAction("listPlatformJobs", {}, admin.auth));
  const announcementJob = (queuedJobs.entries as Array<{
    estimatedRows: number;
    jobType: string;
    status: string;
  }>).find((entry) => entry.jobType === "announcement-comments");
  assert.ok(announcementJob);
  assert.ok(announcementJob.estimatedRows >= 1);
  assert.equal(announcementJob.status, "pending");
  for (let index = 0; index < 10; index += 1) {
    const { data: batch, error: batchError } = await database.call(
      "app_api",
      "backend_process_platform_job_batch",
      { batch_size: 1 },
    );
    if (batchError) throw batchError;
    if (asRecord(batch).hasMore !== true) break;
  }
  const announcementAfterBatch = await tableRow("announcements", "id", policyAnnouncement.id);
  assert.ok(announcementAfterBatch);
  assert.equal(announcementAfterBatch.comments_enabled, false);
  const completedJobs = asRecord(await callAction("listPlatformJobs", {}, admin.auth));
  const completedAnnouncementJob = (completedJobs.entries as Array<{
    affectedRows: number;
    jobType: string;
    status: string;
  }>).find((entry) => entry.jobType === "announcement-comments");
  assert.equal(completedAnnouncementJob?.status, "completed");
  assert.ok(Number(completedAnnouncementJob?.affectedRows) >= 1);
  assert.deepEqual(asRecord(atomicSave.features), {
    announcementCommentsEnabled: false,
    facilitiesEnabled: true,
    issuesEnabled: true,
  });
  assert.equal(
    asRecord((atomicSave.issueCategories as unknown[])
      .find((value) => asRecord(value).id === "public-issues")).label,
    "公共議題-原子",
  );
  assert.equal(
    asRecord((atomicSave.facilityCategories as unknown[])
      .find((value) => asRecord(value).id === "general")).label,
    "一般設備-原子",
  );
  const catalogAfterAtomic = asRecord(await callAction("getCategoryCatalog", {}, user.auth));
  assert.equal(
    asRecord((catalogAfterAtomic.issueCategories as unknown[])
      .find((value) => asRecord(value).id === "public-issues")).label,
    "公共議題-原子",
  );
  await saveCategoryDraft(admin.auth, { announcementCommentsEnabled: true });
});
