import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  expectActionError,
  integrationTest,
  requestId,
  seedActor,
} from "./helpers.ts";

async function createFacility(
  actor: Awaited<ReturnType<typeof seedActor>>,
  label: string,
) {
  const catalog = asRecord(await callAction("getCategoryCatalog", {}, actor.auth));
  const categories = catalog.facilityCategories as Array<Record<string, unknown>>;
  const category = categories.find((value) => value.isDefault === true) ?? categories[0];
  assert.ok(category, "facility category catalog must not be empty");
  const result = asRecord(await callAction("createFacility", {
    categoryId: String(category.id),
    content: `Integration facility content ${label}`,
    location: `Room ${label}`,
    requestId: requestId(`create-facility-${label}`),
    title: `Facility ${label}`.slice(0, 30),
  }, actor.auth));
  return asRecord(result.facility);
}

integrationTest("facility ownership and facility.manage permissions", async () => {
  const owner = await seedActor("facility-owner");
  const user = await seedActor("facility-user");
  const manager = await seedActor("facility-manager", { roles: ["general-affairs"] });
  assert.deepEqual(manager.auth.permissions, ["facility.manage"]);

  const facility = await createFacility(owner, "status");
  const facilityId = String(facility.id);
  const read = asRecord(await callAction("getFacility", { facilityId }, user.auth));
  assert.equal(asRecord(read.facility).id, facilityId);
  const list = asRecord(await callAction("listFacilities", {
    bucket: "active",
    pageSize: 20,
    sort: "latest",
  }, user.auth));
  assert.ok((list.facilities as Array<Record<string, unknown>>).some((row) => row.id === facilityId));

  const affected = asRecord(await callAction("toggleFacilityAffected", {
    facilityId,
    requestId: requestId("facility-affected"),
  }, user.auth));
  assert.equal(affected.affected, true);

  await expectActionError(
    "permission-denied",
    () => callAction("updateFacilityStatus", {
      facilityId,
      requestId: requestId("facility-status-denied"),
      status: "processing",
    }, owner.auth),
  );
  const processing = asRecord(await callAction("updateFacilityStatus", {
    facilityId,
    requestId: requestId("facility-processing"),
    status: "processing",
  }, manager.auth));
  assert.equal(asRecord(processing.facility).status, "processing");
  await expectActionError(
    "missing-result",
    () => callAction("updateFacilityStatus", {
      facilityId,
      requestId: requestId("facility-complete-missing-result"),
      status: "completed",
    }, manager.auth),
  );
  const completed = asRecord(await callAction("updateFacilityStatus", {
    facilityId,
    requestId: requestId("facility-complete"),
    resultContent: "Facility handled",
    status: "completed",
  }, manager.auth));
  assert.equal(asRecord(completed.facility).status, "completed");
  await callAction("deleteFacility", {
    facilityId,
    requestId: requestId("facility-manager-delete"),
  }, manager.auth);

  const ownerDelete = await createFacility(owner, "owner-delete");
  const ownerDeleteId = String(ownerDelete.id);
  await expectActionError(
    "permission-denied",
    () => callAction("deleteFacility", {
      facilityId: ownerDeleteId,
      requestId: requestId("facility-stranger-delete"),
    }, user.auth),
  );
  await callAction("deleteFacility", {
    facilityId: ownerDeleteId,
    requestId: requestId("facility-owner-delete"),
  }, owner.auth);
});

integrationTest("announcement.manage, likes, comments, and ownership", async () => {
  const manager = await seedActor("announcement-manager", {
    roles: ["announcement-manager"],
  });
  const user = await seedActor("announcement-user");
  const stranger = await seedActor("announcement-stranger");
  assert.deepEqual(manager.auth.permissions, ["announcement.manage"]);

  await expectActionError(
    "permission-denied",
    () => callAction("createAnnouncement", {
      content: "Denied announcement",
      requestId: requestId("announcement-denied"),
      title: "Denied",
    }, user.auth),
  );
  const created = asRecord(await callAction("createAnnouncement", {
    content: "Integration announcement content",
    requestId: requestId("announcement-create"),
    title: "Integration announcement",
  }, manager.auth));
  const announcementId = String(asRecord(created.announcement).id);

  const list = asRecord(await callAction("listAnnouncements", {
    pageSize: 30,
  }, user.auth));
  assert.ok((list.announcements as Array<Record<string, unknown>>)
    .some((announcement) => announcement.id === announcementId));
  const read = asRecord(await callAction("getAnnouncement", {
    announcementId,
  }, user.auth));
  assert.equal(asRecord(read.announcement).id, announcementId);

  const liked = asRecord(await callAction("setAnnouncementLike", {
    announcementId,
    liked: true,
    requestId: requestId("announcement-like"),
  }, user.auth));
  assert.equal(liked.liked, true);
  const unliked = asRecord(await callAction("setAnnouncementLike", {
    announcementId,
    liked: false,
    requestId: requestId("announcement-unlike"),
  }, user.auth));
  assert.equal(unliked.liked, false);

  const commentWrite = asRecord(await callAction("createAnnouncementComment", {
    announcementId,
    content: "Integration announcement comment",
    requestId: requestId("announcement-comment"),
  }, user.auth));
  const commentId = String(asRecord(commentWrite.comment).id);
  const comments = asRecord(await callAction("listAnnouncementComments", {
    announcementId,
    pageSize: 30,
  }, stranger.auth));
  assert.ok(JSON.stringify(comments).includes(commentId));
  await expectActionError(
    "permission-denied",
    () => callAction("deleteAnnouncementComment", {
      commentId,
      requestId: requestId("announcement-comment-denied"),
    }, stranger.auth),
  );
  await callAction("deleteAnnouncementComment", {
    commentId,
    requestId: requestId("announcement-comment-owner-delete"),
  }, user.auth);

  const managedCommentWrite = asRecord(await callAction("createAnnouncementComment", {
    announcementId,
    content: "Manager removable announcement comment",
    requestId: requestId("announcement-managed-comment"),
  }, stranger.auth));
  await callAction("deleteAnnouncementComment", {
    commentId: String(asRecord(managedCommentWrite.comment).id),
    requestId: requestId("announcement-manager-comment-delete"),
  }, manager.auth);

  await expectActionError(
    "permission-denied",
    () => callAction("deleteAnnouncement", {
      announcementId,
      requestId: requestId("announcement-delete-denied"),
    }, user.auth),
  );
  await callAction("deleteAnnouncement", {
    announcementId,
    requestId: requestId("announcement-delete"),
  }, manager.auth);
});
