import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  expectActionError,
  integrationTest,
  refreshActor,
  requestId,
  seedActor,
  supabase,
  tableRow,
} from "./helpers.ts";

integrationTest("access, role, idempotency, avatar, and upload actions", async () => {
  const admin = await seedActor("access-admin", { roles: ["platform-admin"] });
  const user = await seedActor("access-user");
  let target = await seedActor("access-target");

  const revisions = asRecord(await callAction("getContentRevisions", {}, user.auth));
  assert.deepEqual(Object.keys(asRecord(revisions.revisions)).sort(), [
    "announcements",
    "facilities",
    "issues",
  ]);

  await callAction("recordPlatformVisit", {}, user.auth);
  assert.ok((await tableRow("user_profiles", "uid", user.auth.uid))?.last_seen_at);

  const userRole = asRecord(await callAction("getCurrentUserRole", {}, user.auth));
  assert.equal(userRole.role, "user");
  const adminRole = asRecord(await callAction("getCurrentUserRole", {}, admin.auth));
  assert.equal(adminRole.role, "admin");
  assert.deepEqual(new Set(admin.auth.permissions), new Set([
    "announcement.manage",
    "category.manage",
    "dashboard.view",
    "facility.manage",
    "proposal.manage",
    "role.manage",
  ]));

  await expectActionError(
    "permission-denied",
    () => callAction("listRoleAssignments", { query: target.auth.uid }, user.auth),
  );
  const roleSearch = asRecord(await callAction(
    "listRoleAssignments",
    { query: target.auth.uid },
    admin.auth,
  ));
  assert.equal((roleSearch.users as unknown[]).length, 1);

  await expectActionError(
    "validation-required",
    () => callAction("setUserRoles", {
      managedIssueCategoryIds: [],
      roles: ["announcement-manager"],
      uid: target.auth.uid,
    }, admin.auth),
  );
  await expectActionError(
    "permission-denied",
    () => callAction("setUserRoles", {
      managedIssueCategoryIds: [],
      requestId: requestId("denied-role"),
      roles: ["announcement-manager"],
      uid: target.auth.uid,
    }, user.auth),
  );

  const roleRequestId = requestId("set-role");
  const rolePayload = {
    managedFacilityCategoryIds: ["general"],
    managedIssueCategoryIds: ["public-issues"],
    requestId: roleRequestId,
    roles: ["announcement-manager"],
    uid: target.auth.uid,
  };
  const firstRoleWrite = await callAction("setUserRoles", rolePayload, admin.auth);
  const replayedRoleWrite = await callAction("setUserRoles", rolePayload, admin.auth);
  assert.deepEqual(replayedRoleWrite, firstRoleWrite);
  target = await refreshActor(target);
  assert.ok(target.auth.permissions.includes("announcement.manage"));
  assert.ok(!target.auth.permissions.includes("facility.manage"));
  assert.ok(target.auth.permissions.includes("proposal.manage"));
  assert.deepEqual(target.auth.managedFacilityCategoryIds, ["general"]);

  const proposalAssignees = asRecord(await callAction("listRoleAssignments", {
    categoryId: "public-issues", query: "", scopeKind: "issue",
  }, admin.auth));
  assert.ok((proposalAssignees.users as Array<{ uid: string }>).some((row) => row.uid === target.auth.uid));
  assert.ok(!(proposalAssignees.users as Array<{ uid: string }>).some((row) => row.uid === admin.auth.uid));
  const facilityAssignees = asRecord(await callAction("listRoleAssignments", {
    categoryId: "general", query: "", scopeKind: "facility",
  }, admin.auth));
  assert.ok((facilityAssignees.users as Array<{ uid: string }>).some((row) => row.uid === target.auth.uid));
  assert.ok(!(facilityAssignees.users as Array<{ uid: string }>).some((row) => row.uid === admin.auth.uid));
  const announcementAssignees = asRecord(await callAction("listRoleAssignments", {
    query: "", scopeKind: "announcement",
  }, admin.auth));
  assert.ok((announcementAssignees.users as Array<{ uid: string }>).some((row) => row.uid === target.auth.uid));
  assert.ok(!(announcementAssignees.users as Array<{ uid: string }>).some((row) => row.uid === admin.auth.uid));
  await expectActionError("validation-required", () => callAction("listRoleAssignments", {
    query: "", scopeKind: "platform",
  }, admin.auth));
  await expectActionError("validation-invalid", () => callAction("setUserRoles", {
    managedFacilityCategoryIds: [],
    managedIssueCategoryIds: [],
    requestId: requestId("platform-role-api-denied"),
    roles: ["platform-admin"],
    uid: target.auth.uid,
  }, admin.auth));
  await expectActionError("permission-denied", () => callAction("setUserRoles", {
    managedFacilityCategoryIds: [],
    managedIssueCategoryIds: [],
    requestId: requestId("platform-role-revoke-denied"),
    roles: [],
    uid: admin.auth.uid,
  }, admin.auth));

  await expectActionError("validation-invalid", () => callAction("setUserRoles", {
    managedFacilityCategoryIds: [],
    managedIssueCategoryIds: ["missing-category"],
    requestId: requestId("invalid-category-assignment"),
    roles: [],
    uid: target.auth.uid,
  }, admin.auth));
  target = await refreshActor(target);
  assert.ok(target.auth.permissions.includes("announcement.manage"), "invalid writes must roll back without changing roles");

  const { data: accessAudit, error: accessAuditError } = await supabase.schema("app_private")
    .from("access_assignment_audit").select("actor_uid,target_uid,before_value,after_value")
    .eq("target_uid", target.auth.uid);
  if (accessAuditError) throw accessAuditError;
  assert.equal(accessAudit.length, 1);
  assert.equal(accessAudit[0]?.actor_uid, admin.auth.uid);

  const configuredAdmin = await seedActor("configured-admin");
  const staleAdmin = await seedActor("stale-admin", { roles: ["platform-admin"] });
  const { error: reconcileError } = await supabase.schema("app_api").rpc("backend_reconcile_platform_admins", {
    actor_uid: admin.auth.uid,
    admin_emails: [admin.identity.email, configuredAdmin.identity.email],
  });
  if (reconcileError) throw reconcileError;
  const configuredAdminRole = await supabase.schema("app_private").from("user_role_assignments")
    .select("uid").eq("uid", configuredAdmin.auth.uid).eq("role_code", "platform-admin").maybeSingle();
  const staleAdminRole = await supabase.schema("app_private").from("user_role_assignments")
    .select("uid").eq("uid", staleAdmin.auth.uid).eq("role_code", "platform-admin").maybeSingle();
  if (configuredAdminRole.error) throw configuredAdminRole.error;
  if (staleAdminRole.error) throw staleAdminRole.error;
  assert.equal(configuredAdminRole.data?.uid, configuredAdmin.auth.uid);
  assert.equal(staleAdminRole.data, null);

  const avatar = asRecord(await callAction("cacheUserAvatar", {}, user.auth));
  assert.equal(avatar.photoUrl, null);
  const avatars = asRecord(await callAction(
    "getUserAvatarUrls",
    { uids: [user.auth.uid, target.auth.uid] },
    user.auth,
  ));
  assert.ok(user.auth.uid in asRecord(avatars.avatars));

  const createUploadRequestId = requestId("create-upload");
  const uploadResult = asRecord(await callAction("createImageUploadSessions", {
    images: [{
      contentType: "image/webp",
      height: 64,
      size: 256,
      width: 64,
    }],
    requestId: createUploadRequestId,
  }, user.auth));
  const session = asRecord((uploadResult.sessions as unknown[])[0]);
  assert.match(String(session.signature), /^[a-f0-9]{40}$/u);
  const uploadId = String(session.uploadId);

  const { error: readyError } = await supabase.schema("app_private")
    .from("uploads")
    .update({ status: "ready" })
    .eq("id", uploadId);
  if (readyError) throw readyError;
  const finalized = asRecord(await callAction("finalizeImageUploads", {
    requestId: requestId("finalize-upload"),
    uploads: [{ uploadId }],
  }, user.auth));
  assert.equal(asRecord((finalized.uploads as unknown[])[0]).uploadId, uploadId);

  const resolved = asRecord(await callAction(
    "resolveUploadImageUrls",
    { uploadIds: [uploadId] },
    user.auth,
  ));
  assert.match(String(asRecord(resolved.urls)[uploadId]), /^https:\/\/api\.cloudinary\.com\//u);
  const hidden = asRecord(await callAction(
    "resolveUploadImageUrls",
    { uploadIds: [uploadId] },
    target.auth,
  ));
  assert.equal(asRecord(hidden.errors)[uploadId], "not-found");

  const deleted = asRecord(await callAction("deleteUploadedImages", {
    requestId: requestId("delete-upload"),
    storagePaths: [String(session.folder) + "/" + String(session.publicId)],
  }, user.auth));
  assert.equal(deleted.deleted, 1);
  assert.equal(await tableRow("uploads", "id", uploadId), null);
});

integrationTest("runtime category setup and management enforce platform permissions and immutable privacy", async () => {
  const admin = await seedActor("category-admin", { roles: ["platform-admin"] });
  const user = await seedActor("category-user");

  const catalog = asRecord(await callAction("getCategoryCatalog", {}, user.auth));
  assert.ok((catalog.issueCategories as unknown[]).length >= 2);
  assert.ok((catalog.facilityCategories as unknown[]).length >= 1);
  assert.deepEqual(asRecord(catalog.features), { facilitiesEnabled: true, issuesEnabled: true });
  await expectActionError("permission-denied", () => callAction("getCategoryManagement", {}, user.auth));
  await expectActionError("permission-denied", () => callAction("completeInitialSetup", {
    facilitiesEnabled: false, facilityCategories: [], issuesEnabled: false,
    issueCategories: [], requestId: requestId("setup-denied"),
  }, user.auth));
  await expectActionError("permission-denied", () => callAction("savePlatformFeatures", {
    facilitiesEnabled: false, issuesEnabled: false, requestId: requestId("features-denied"),
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
  assert.deepEqual(asRecord(management.features), { facilitiesEnabled: false, issuesEnabled: true });
  const publicCategory = asRecord((management.issueCategories as unknown[])
    .find((value) => asRecord(value).id === "public-issues"));
  const savedIssue = asRecord(await callAction("saveIssueCategory", {
    category: { ...publicCategory, label: "公共議題-修改" },
    requestId: requestId("save-issue-category"),
  }, admin.auth));
  assert.equal(asRecord(savedIssue.category).label, "公共議題-修改");
  await expectActionError("immutable-category-policy", () => callAction("saveIssueCategory", {
    category: { ...publicCategory, readAccess: "school" },
    requestId: requestId("immutable-category"),
  }, admin.auth));
  await expectActionError("permission-denied", () => callAction("saveIssueCategory", {
    category: publicCategory, requestId: requestId("save-issue-denied"),
  }, user.auth));

  const savedFacility = asRecord(await callAction("saveFacilityCategory", {
    category: {
      id: "general", isActive: true, isDefault: true, label: "一般設備-修改", sortOrder: 0,
    },
    requestId: requestId("save-facility-category"),
  }, admin.auth));
  assert.equal(asRecord(savedFacility.category).label, "一般設備-修改");
  const enabledFeatures = asRecord(await callAction("savePlatformFeatures", {
    facilitiesEnabled: true, issuesEnabled: true, requestId: requestId("enable-features"),
  }, admin.auth));
  assert.deepEqual(enabledFeatures, { facilitiesEnabled: true, issuesEnabled: true, success: true });
  const updatedCatalog = asRecord(await callAction("getCategoryCatalog", {}, user.auth));
  assert.deepEqual(asRecord(updatedCatalog.features), { facilitiesEnabled: true, issuesEnabled: true });
});

integrationTest("category deletion removes category and all associated resources, queueing cloudinary deletion and outbox events", async () => {
  const admin = await seedActor("delete-cat-admin", { roles: ["platform-admin"] });
  const user = await seedActor("delete-cat-user");

  const managementBefore = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  const issueCats = managementBefore.issueCategories as unknown[];

  const defaultIssueCat = asRecord(issueCats.find(c => asRecord(c).isDefault));
  assert.ok(defaultIssueCat, "Should find a default issue category");

  // 1. Try to delete default category - expect error
  await expectActionError("cannot-delete-default-category", () => callAction("deleteCategory", {
    kind: "issue", id: String(defaultIssueCat.id), requestId: requestId("del-def-issue")
  }, admin.auth));

  // 2. Create a temporary category to delete
  const tempCategoryPayload = {
    category: {
      id: "temp-cat-to-delete",
      label: "臨時分類",
      readAccess: "school",
      authorVisible: true,
      supportEnabled: false,
      supportGoal: null,
      supportDeadlineDays: null,
      responseDeadlineDays: null,
      commentsEnabled: true,
      isActive: true,
      isDefault: false,
      sortOrder: 99,
    },
    requestId: requestId("create-temp-category"),
  };
  await callAction("saveIssueCategory", tempCategoryPayload, admin.auth);

  // 3. User tries to delete temporary category - expect permission-denied
  await expectActionError("permission-denied", () => callAction("deleteCategory", {
    kind: "issue", id: "temp-cat-to-delete", requestId: requestId("del-issue-user")
  }, user.auth));

  // 4. Create an issue in temporary category to verify cascade deletion
  const issuePayload = {
    title: "測試提案案件",
    content: "這是一個測試提案",
    category: "temp-cat-to-delete",
    authorName: "測試者",
    requestId: requestId("create-issue-to-delete"),
  };
  const createdIssue = asRecord(await callAction("createIssue", issuePayload, user.auth));
  const issueId = asRecord(createdIssue.issue).id;
  assert.ok(issueId);

  // 5. Admin deletes temporary category
  const res = asRecord(await callAction("deleteCategory", {
    kind: "issue", id: "temp-cat-to-delete", requestId: requestId("del-issue-success")
  }, admin.auth));
  assert.equal(res.success, true);

  // 6. Verify temporary category is gone
  const managementAfter = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  const issueCatsAfter = managementAfter.issueCategories as unknown[];
  assert.equal(issueCatsAfter.some(c => asRecord(c).id === "temp-cat-to-delete"), false);

  // 7. Verify issue is cascade deleted
  assert.equal(await tableRow("issues", "id", String(issueId)), null);

  // 8. Verify outbox event is queued
  const { data: outboxRows, error: outboxError } = await supabase
    .schema("app_private")
    .from("outbox_events")
    .select("*")
    .eq("target_id", String(issueId))
    .eq("event_type", "issue.deleted");
  if (outboxError) throw outboxError;

  assert.equal(outboxRows.length, 1);
  const outboxRow = outboxRows[0];
  assert.ok(outboxRow);
  assert.equal(asRecord(outboxRow).event_type, "issue.deleted");

  await expectActionError("not-found", () => callAction("deleteCategory", {
    kind: "issue", id: "temp-cat-to-delete", requestId: requestId("del-missing-issue"),
  }, admin.auth));

  const { data: deletionAudit, error: deletionAuditError } = await supabase.schema("app_private")
    .from("category_configuration_audit").select("domain,category_id,operation,actor_uid")
    .eq("category_id", "temp-cat-to-delete").eq("operation", "delete");
  if (deletionAuditError) throw deletionAuditError;
  assert.equal(deletionAudit.length, 1);
  assert.equal(deletionAudit[0]?.actor_uid, admin.auth.uid);
});
