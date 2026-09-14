import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  expectActionError,
  insertReadyUpload,
  integrationTest,
  refreshActor,
  saveCategoryDraft,
  seedActor,
  database,
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
  for (const version of Object.values(asRecord(versions.versions))) {
    assert.ok(Number(version) > 1_000_000_000_000);
  }

  const bootstrap = asRecord(await callAction("getSessionBootstrap", { recordVisit: true }, user.auth));
  assert.equal(asRecord(bootstrap.access).role, "user");
  assert.deepEqual(Object.keys(asRecord(bootstrap.versions)).sort(), [
    "announcements",
    "facilities",
    "issues",
  ]);
  assert.deepEqual(bootstrap.versions, versions.versions);
  assert.ok(Array.isArray(asRecord(bootstrap.catalog).issueCategories));
  assert.equal(typeof asRecord(bootstrap.notificationUnread).hasUnread, "boolean");
  assert.equal(bootstrap.visitRecorded, true);
  const firstVisitAt = (await tableRow("user_profiles", "uid", user.auth.uid))?.last_seen_at;
  assert.ok(firstVisitAt);
  const repeatedBootstrap = asRecord(await callAction("getSessionBootstrap", { recordVisit: true }, user.auth));
  assert.equal(repeatedBootstrap.visitRecorded, true);
  assert.equal((await tableRow("user_profiles", "uid", user.auth.uid))?.last_seen_at, firstVisitAt);

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
  assert.equal(
    (emptyScopeAssignees.users as Array<{ uid: string }>)
      .some((assignee) => assignee.uid === target.auth.uid),
    false,
  );
  await expectActionError("validation-required", () => callAction("listRoleAssignments", {
    query: "",
  }, admin.auth));

  await expectActionError(
    "permission-denied",
    () => callAction("setUserAccessScope", {
      grant: true,
      scopeKind: "announcement",
      uid: target.auth.uid,
    }, user.auth),
  );

  const roleOperationId = crypto.randomUUID();
  const rolePayload = {
    grant: true,
    scopeKind: "announcement",
    uid: target.auth.uid,
  };
  const firstRoleWrite = await callAction("setUserAccessScope", rolePayload, admin.auth, roleOperationId);
  const replayedRoleWrite = await callAction("setUserAccessScope", rolePayload, admin.auth, roleOperationId);
  assert.deepEqual(replayedRoleWrite, firstRoleWrite);
  await callAction("setUserAccessScope", {
    categoryId: "public-issues",
    grant: true,
    scopeKind: "issue",
    uid: target.auth.uid,
  }, admin.auth);
  await callAction("setUserAccessScope", {
    categoryId: "general",
    grant: true,
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
    scopeKind: "platform",
    uid: target.auth.uid,
  }, admin.auth));
  await expectActionError("permission-denied", () => callAction("setUserAccessScope", {
    grant: false,
    scopeKind: "announcement",
    uid: admin.auth.uid,
  }, admin.auth));

  await expectActionError("validation-invalid", () => callAction("setUserAccessScope", {
    categoryId: "missing-category",
    grant: true,
    scopeKind: "issue",
    uid: target.auth.uid,
  }, admin.auth));
  target = await refreshActor(target);
  assert.ok(target.auth.permissions.includes("announcement.manage"), "invalid writes must roll back without changing roles");

  await database.sql`update app_private.user_facility_category_assignments
    set notify_on_created = false
    where uid = ${target.auth.uid} and category_id = 'general'`;
  await callAction("setUserAccessScope", {
    categoryId: "general",
    grant: true,
    scopeKind: "facility",
    uid: target.auth.uid,
  }, admin.auth);
  const facilityOptOut = await database.sqlOne<{ notify_on_created: boolean }>`
    select notify_on_created from app_private.user_facility_category_assignments
    where uid = ${target.auth.uid} and category_id = 'general'`;
  assert.equal(facilityOptOut.notify_on_created, false, "an existing notification opt-out must survive access updates");

  const concurrentTarget = await seedActor("access-concurrent-target");
  await Promise.all([
    callAction("setUserAccessScope", {
      categoryId: "public-issues",
      grant: true,
      scopeKind: "issue",
      uid: concurrentTarget.auth.uid,
    }, admin.auth),
    callAction("setUserAccessScope", {
      categoryId: "general",
      grant: true,
      scopeKind: "facility",
      uid: concurrentTarget.auth.uid,
    }, admin.auth),
  ]);
  const refreshedConcurrentTarget = await refreshActor(concurrentTarget);
  assert.deepEqual(refreshedConcurrentTarget.auth.managedIssueCategoryIds, ["public-issues"]);
  assert.deepEqual(refreshedConcurrentTarget.auth.managedFacilityCategoryIds, ["general"]);

  const { rows: accessAudit } = await database.sql<{ actor_uid: string }>`
    select actor_uid, target_uid, before_value, after_value
    from app_private.access_assignment_audit where target_uid = ${target.auth.uid}`;
  assert.equal(accessAudit.length, 3);
  assert.ok(accessAudit.every((entry) => entry.actor_uid === admin.auth.uid));

  const configuredAdmin = await seedActor("configured-admin");
  const staleAdmin = await seedActor("stale-admin", { roles: ["platform-admin"] });
  const { error: reconcileError } = await database.call("app_api", "backend_reconcile_platform_admins", {
    actor_uid: admin.auth.uid,
    admin_emails: [admin.identity.email, configuredAdmin.identity.email],
  });
  if (reconcileError) throw reconcileError;
  const platformAdminRole = async (uid: string) => await database.sqlMaybe<{ uid: string }>`
    select uid from app_private.user_role_assignments
    where uid = ${uid} and role_code = 'platform-admin'`;
  assert.equal((await platformAdminRole(configuredAdmin.auth.uid))?.uid, configuredAdmin.auth.uid);
  assert.equal(await platformAdminRole(staleAdmin.auth.uid), null);

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
  await database.sql`update app_private.user_profiles
    set display_name = ${renamedDisplayName} where uid = ${user.auth.uid}`;
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
  await database.sql`update app_private.user_profiles
    set avatar_public_id = ${previousAvatarPublicId}, avatar_version = 1
    where uid = ${user.auth.uid}`;
  const { error: commitAvatarError } = await database.call("app_api", "backend_commit_user_avatar", {
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
  const { rows: previousAvatarJobs } = await database.sql<{ payload: unknown }>`
    select payload, job_type from app_private.background_jobs
    where scope_id = ${user.auth.uid} and job_type = 'deletion'`;
  assert.equal(previousAvatarJobs.length, 1);
  assert.equal(asRecord(previousAvatarJobs[0].payload).cloudinary_public_id, previousAvatarPublicId);

  for (const [table, removedColumn] of [
    ["issues", "author_name"],
    ["comments", "author_photo_url"],
    ["announcements", "author_name"],
    ["announcement_comments", "author_photo_url"],
    ["facility_reports", "author_name"],
    ["notifications", "actor_photo_url"],
  ] as const) {
    await assert.rejects(
      () => database.query(`select ${removedColumn} from app_private.${table} limit 1`),
      (error: unknown) => (error as { code?: string }).code === "42703",
      `${table}.${removedColumn} must be removed`,
    );
  }

  const uploadResult = asRecord(await callAction("createImageUploadSessions", {
    images: [{
      contentType: "image/webp",
      height: 64,
      size: 256,
      width: 64,
    }],
    targetType: "issue",
  }, user.auth));
  const session = asRecord((uploadResult.sessions as unknown[])[0]);
  assert.match(String(session.signature), /^[a-f0-9]{40}$/u);
  const uploadId = String(session.uploadId);

  await database.sql`update app_private.uploads set status = 'ready' where id = ${uploadId}`;
  const finalized = asRecord(await callAction("finalizeImageUploads", {
    targetType: "issue",
    uploads: [{ uploadId }],
  }, user.auth));
  assert.equal(asRecord((finalized.uploads as unknown[])[0]).uploadId, uploadId);

  const resolved = asRecord(await callAction(
    "resolveUploadImageUrls",
    { uploadIds: [uploadId] },
    user.auth,
  ));
  assert.match(String(asRecord(resolved.fullUrls)[uploadId]), /^http:\/\/127\.0\.0\.1:8787\/v1\/media\/.+\/full$/u);
  assert.match(String(asRecord(resolved.thumbnailUrls)[uploadId]), /^http:\/\/127\.0\.0\.1:8787\/v1\/media\/.+\/thumbnail$/u);
  const hidden = asRecord(await callAction(
    "resolveUploadImageUrls",
    { uploadIds: [uploadId] },
    target.auth,
  ));
  assert.equal(asRecord(hidden.errors)[uploadId], "not-found");

  const deleted = asRecord(await callAction("deleteUploadedImages", {
    storagePaths: [String(session.folder) + "/" + String(session.publicId)],
  }, user.auth));
  assert.equal(deleted.deleted, 1);
  assert.equal(await tableRow("uploads", "id", uploadId), null);
});
