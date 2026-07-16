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
    "request-id-required",
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
    managedIssueCategoryIds: [],
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
