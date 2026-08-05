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
  supabase,
  tableRow,
} from "../helpers.ts";

integrationTest("access, role, idempotency, avatar, and upload actions", async () => {
  const admin = await seedActor("access-admin", { roles: ["platform-admin"] });
  const user = await seedActor("access-user");
  let target = await seedActor("access-target");

  const versions = asRecord(await callAction("getContentVersions", {}, user.auth));
  assert.deepEqual(Object.keys(asRecord(versions.versions)).sort(), [
    "announcements",
    "facilities",
    "issues",
  ]);

  const bootstrap = asRecord(await callAction("getSessionBootstrap", { recordVisit: true }, user.auth));
  assert.equal(asRecord(bootstrap.access).role, "user");
  assert.deepEqual(Object.keys(asRecord(bootstrap.versions)).sort(), [
    "announcements",
    "facilities",
    "issues",
  ]);
  assert.ok(Array.isArray(asRecord(bootstrap.catalog).issueCategories));
  assert.equal(typeof asRecord(bootstrap.notificationUnread).hasUnread, "boolean");
  assert.equal(bootstrap.visitRecorded, true);
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
  await expectActionError(
    "permission-denied",
    () => callAction("listRoleAssignments", {
      categoryId: "public-issues", query: "", scopeKind: "issue",
    }, user.auth),
  );
  const roleSearch = asRecord(await callAction(
    "listRoleAssignments",
    { query: target.auth.uid },
    admin.auth,
  ));
  assert.equal((roleSearch.users as unknown[]).length, 1);
  const emptyScopeAssignees = asRecord(await callAction("listRoleAssignments", {
    categoryId: "public-issues", query: "", scopeKind: "issue",
  }, admin.auth));
  assert.equal((emptyScopeAssignees.users as unknown[]).length, 0);
  await expectActionError("validation-required", () => callAction("listRoleAssignments", {
    query: "",
  }, admin.auth));

  await expectActionError(
    "validation-required",
    () => callAction("setUserAccessScope", {
      grant: true,
      scopeKind: "announcement",
      uid: target.auth.uid,
    }, admin.auth),
  );
  await expectActionError(
    "permission-denied",
    () => callAction("setUserAccessScope", {
      grant: true,
      requestId: requestId("denied-role"),
      scopeKind: "announcement",
      uid: target.auth.uid,
    }, user.auth),
  );

  const roleRequestId = requestId("set-role");
  const rolePayload = {
    grant: true,
    requestId: roleRequestId,
    scopeKind: "announcement",
    uid: target.auth.uid,
  };
  const firstRoleWrite = await callAction("setUserAccessScope", rolePayload, admin.auth);
  const replayedRoleWrite = await callAction("setUserAccessScope", rolePayload, admin.auth);
  assert.deepEqual(replayedRoleWrite, firstRoleWrite);
  await callAction("setUserAccessScope", {
    categoryId: "public-issues",
    grant: true,
    requestId: requestId("set-issue-scope"),
    scopeKind: "issue",
    uid: target.auth.uid,
  }, admin.auth);
  await callAction("setUserAccessScope", {
    categoryId: "general",
    grant: true,
    requestId: requestId("set-facility-scope"),
    scopeKind: "facility",
    uid: target.auth.uid,
  }, admin.auth);
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
  await expectActionError("validation-required", () => callAction("setUserAccessScope", {
    grant: true,
    requestId: requestId("platform-role-api-denied"),
    scopeKind: "platform",
    uid: target.auth.uid,
  }, admin.auth));
  await expectActionError("permission-denied", () => callAction("setUserAccessScope", {
    grant: false,
    requestId: requestId("platform-role-revoke-denied"),
    scopeKind: "announcement",
    uid: admin.auth.uid,
  }, admin.auth));

  await expectActionError("validation-invalid", () => callAction("setUserAccessScope", {
    categoryId: "missing-category",
    grant: true,
    requestId: requestId("invalid-category-assignment"),
    scopeKind: "issue",
    uid: target.auth.uid,
  }, admin.auth));
  target = await refreshActor(target);
  assert.ok(target.auth.permissions.includes("announcement.manage"), "invalid writes must roll back without changing roles");

  const { error: optOutError } = await supabase.schema("app_private")
    .from("user_facility_category_assignments")
    .update({ notify_on_created: false })
    .eq("uid", target.auth.uid)
    .eq("category_id", "general");
  if (optOutError) throw optOutError;
  await callAction("setUserAccessScope", {
    categoryId: "general",
    grant: true,
    requestId: requestId("preserve-facility-opt-out"),
    scopeKind: "facility",
    uid: target.auth.uid,
  }, admin.auth);
  const { data: facilityOptOut, error: facilityOptOutReadError } = await supabase.schema("app_private")
    .from("user_facility_category_assignments")
    .select("notify_on_created")
    .eq("uid", target.auth.uid)
    .eq("category_id", "general")
    .single();
  if (facilityOptOutReadError) throw facilityOptOutReadError;
  assert.equal(facilityOptOut.notify_on_created, false, "an existing notification opt-out must survive access updates");

  const concurrentTarget = await seedActor("access-concurrent-target");
  await Promise.all([
    callAction("setUserAccessScope", {
      categoryId: "public-issues",
      grant: true,
      requestId: requestId("concurrent-issue-scope"),
      scopeKind: "issue",
      uid: concurrentTarget.auth.uid,
    }, admin.auth),
    callAction("setUserAccessScope", {
      categoryId: "general",
      grant: true,
      requestId: requestId("concurrent-facility-scope"),
      scopeKind: "facility",
      uid: concurrentTarget.auth.uid,
    }, admin.auth),
  ]);
  const refreshedConcurrentTarget = await refreshActor(concurrentTarget);
  assert.deepEqual(refreshedConcurrentTarget.auth.managedIssueCategoryIds, ["public-issues"]);
  assert.deepEqual(refreshedConcurrentTarget.auth.managedFacilityCategoryIds, ["general"]);

  const { data: accessAudit, error: accessAuditError } = await supabase.schema("app_private")
    .from("access_assignment_audit").select("actor_uid,target_uid,before_value,after_value")
    .eq("target_uid", target.auth.uid);
  if (accessAuditError) throw accessAuditError;
  assert.equal(accessAudit.length, 3);
  assert.ok(accessAudit.every((entry) => entry.actor_uid === admin.auth.uid));

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
  const profiles = asRecord(await callAction(
    "getUserPublicProfiles",
    { uids: [user.auth.uid, target.auth.uid] },
    user.auth,
  ));
  const publicProfiles = asRecord(profiles.profiles);
  const publicProfile = asRecord(publicProfiles[user.auth.uid]);
  assert.equal(publicProfile.uid, user.auth.uid);
  assert.equal(publicProfile.displayName, user.auth.name);
  assert.equal(publicProfile.photoUrl, null);
  assert.equal(publicProfile.version, 1);

  const renamedDisplayName = `${user.auth.name} renamed`;
  const { error: renameError } = await supabase.schema("app_private").from("user_profiles")
    .update({ display_name: renamedDisplayName }).eq("uid", user.auth.uid);
  if (renameError) throw renameError;
  const refreshedProfiles = asRecord(await callAction(
    "getUserPublicProfiles",
    { uids: [user.auth.uid] },
    user.auth,
  ));
  const refreshedProfile = asRecord(asRecord(refreshedProfiles.profiles)[user.auth.uid]);
  assert.equal(refreshedProfile.displayName, renamedDisplayName);
  assert.equal(refreshedProfile.version, 2);

  const previousAvatarPublicId = `srp/avatars/${user.auth.uid}_previous`;
  const nextAvatarPublicId = `srp/avatars/${user.auth.uid}_next`;
  const { error: seedAvatarError } = await supabase.schema("app_private").from("user_profiles")
    .update({ avatar_public_id: previousAvatarPublicId, avatar_version: 1 }).eq("uid", user.auth.uid);
  if (seedAvatarError) throw seedAvatarError;
  const { error: commitAvatarError } = await supabase.schema("app_api").rpc("backend_commit_user_avatar", {
    actor_uid: user.auth.uid,
    next_avatar_hash: "integration-avatar-hash",
    next_avatar_public_id: nextAvatarPublicId,
    next_avatar_source_url: "https://lh3.googleusercontent.com/integration-avatar",
    next_cached_photo_url: "https://media.novae.invalid/avatar-next",
    next_avatar_version: 2,
    next_display_name: renamedDisplayName,
  });
  if (commitAvatarError) throw commitAvatarError;
  const committedAvatarProfile = await tableRow("user_profiles", "uid", user.auth.uid);
  assert.equal(committedAvatarProfile?.avatar_public_id, nextAvatarPublicId);
  const { data: previousAvatarJobs, error: previousAvatarJobsError } = await supabase
    .schema("app_private").from("deletion_jobs").select("cloudinary_public_id,target_type")
    .eq("cloudinary_public_id", previousAvatarPublicId);
  if (previousAvatarJobsError) throw previousAvatarJobsError;
  assert.deepEqual(previousAvatarJobs, [{ cloudinary_public_id: previousAvatarPublicId, target_type: "avatar" }]);

  for (const [table, removedColumn] of [
    ["issues", "author_name"],
    ["comments", "author_photo_url"],
    ["announcements", "author_name"],
    ["announcement_comments", "author_photo_url"],
    ["facility_reports", "author_name"],
    ["notifications", "actor_photo_url"],
  ] as const) {
    const { error } = await supabase.schema("app_private").from(table).select(removedColumn).limit(1);
    assert.equal(error?.code, "42703", `${table}.${removedColumn} must be removed`);
  }

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
  assert.match(String(asRecord(resolved.fullUrls)[uploadId]), /^http:\/\/127\.0\.0\.1:1\/v1\/media\/.+\/full$/u);
  assert.match(String(asRecord(resolved.thumbnailUrls)[uploadId]), /^http:\/\/127\.0\.0\.1:1\/v1\/media\/.+\/thumbnail$/u);
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
