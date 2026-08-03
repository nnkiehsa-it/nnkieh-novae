import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  expectActionError,
  integrationTest,
  requestId,
  saveCategoryDraft,
  seedActor,
} from "./helpers.ts";

async function createFacility(
  actor: Awaited<ReturnType<typeof seedActor>>,
  label: string,
  content = `Integration facility content ${label}`,
) {
  const catalog = asRecord(await callAction("getCategoryCatalog", {}, actor.auth));
  const categories = catalog.facilityCategories as Array<Record<string, unknown>>;
  const category = categories.find((value) => value.isDefault === true) ?? categories[0];
  assert.ok(category, "facility category catalog must not be empty");
  const result = asRecord(await callAction("createFacility", {
    categoryId: String(category.id),
    content,
    location: `Room ${label}`,
    requestId: requestId(`create-facility-${label}`),
    title: `Facility ${label}`.slice(0, 30),
  }, actor.auth));
  return asRecord(result.facility);
}

integrationTest("facility details are optional", async () => {
  const owner = await seedActor("facility-optional-details");
  const facility = await createFacility(owner, "optional", "");
  assert.equal(facility.content, "");
});

integrationTest("facility ownership and category-scoped management permissions", async () => {
  const owner = await seedActor("facility-owner");
  const user = await seedActor("facility-user");

  const facility = await createFacility(owner, "status");
  const facilityId = String(facility.id);
  const facilityCategoryId = String(facility.category_id);
  const manager = await seedActor("facility-manager", {
    facilityCategoryIds: [facilityCategoryId],
    roles: ["general-affairs"],
  });
  const wrongCategoryManager = await seedActor("wrong-facility-manager", { roles: ["general-affairs"] });
  assert.deepEqual(manager.auth.permissions, ["facility.manage"]);
  const read = asRecord(await callAction("getFacility", { facilityId }, user.auth));
  assert.equal(asRecord(read.facility).id, facilityId);
  const list = asRecord(await callAction("listFacilities", {
    bucket: "active",
    categoryId: facilityCategoryId,
    pageSize: 20,
    sort: "latest",
  }, user.auth));
  assert.ok((list.facilities as Array<Record<string, unknown>>).some((row) => row.id === facilityId));
  assert.ok((list.facilities as Array<Record<string, unknown>>).every((row) => row.category_id === facilityCategoryId));

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
  await expectActionError(
    "permission-denied",
    () => callAction("updateFacilityStatus", {
      facilityId,
      requestId: requestId("facility-status-wrong-category"),
      status: "processing",
    }, wrongCategoryManager.auth),
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
  const admin = await seedActor("announcement-settings-admin", { roles: ["platform-admin"] });
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
  await expectActionError(
    "permission-denied",
    () => callAction("setAnnouncementCommentsEnabled", {
      announcementId,
      enabled: false,
      requestId: requestId("announcement-comments-close-denied"),
    }, user.auth),
  );
  const closedComments = asRecord(await callAction("setAnnouncementCommentsEnabled", {
    announcementId,
    enabled: false,
    requestId: requestId("announcement-comments-close"),
  }, manager.auth));
  assert.equal(asRecord(closedComments.announcement).comments_enabled, false);
  await expectActionError(
    "comments-disabled",
    () => callAction("createAnnouncementComment", {
      announcementId,
      content: "Must be rejected while announcement comments are closed",
      requestId: requestId("announcement-comment-while-closed"),
    }, stranger.auth),
  );
  const comments = asRecord(await callAction("listAnnouncementComments", {
    announcementId,
    pageSize: 30,
  }, stranger.auth));
  assert.ok(JSON.stringify(comments).includes(commentId));
  const reopenedComments = asRecord(await callAction("setAnnouncementCommentsEnabled", {
    announcementId,
    enabled: true,
    requestId: requestId("announcement-comments-reopen"),
  }, manager.auth));
  assert.equal(asRecord(reopenedComments.announcement).comments_enabled, true);
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

  await callAction("setAnnouncementCommentsEnabled", {
    announcementId,
    enabled: false,
    requestId: requestId("announcement-manual-close-before-global"),
  }, manager.auth);
  const following = asRecord(await callAction("createAnnouncement", {
    content: "Follows the global announcement comment setting",
    requestId: requestId("announcement-global-following-create"),
    title: "Global setting follower",
  }, manager.auth));
  const followingId = String(asRecord(following.announcement).id);

  await saveCategoryDraft(admin.auth, { announcementCommentsEnabled: false });
  for (const id of [announcementId, followingId]) {
    const globallyClosed = asRecord(await callAction("getAnnouncement", {
      announcementId: id,
    }, user.auth));
    assert.equal(asRecord(globallyClosed.announcement).comments_enabled, false);
    assert.equal(asRecord(globallyClosed.announcement).comments_globally_enabled, false);
  }
  await expectActionError(
    "comments-disabled",
    () => callAction("setAnnouncementCommentsEnabled", {
      announcementId: followingId,
      enabled: true,
      requestId: requestId("announcement-global-single-reopen-denied"),
    }, manager.auth),
  );
  await expectActionError(
    "comments-disabled",
    () => callAction("createAnnouncementComment", {
      announcementId: followingId,
      content: "Must be rejected by the global setting",
      requestId: requestId("announcement-global-comment-denied"),
    }, stranger.auth),
  );
  const createdWhileClosed = asRecord(await callAction("createAnnouncement", {
    content: "Created while global comments are closed",
    requestId: requestId("announcement-created-while-global-closed"),
    title: "Created while closed",
  }, manager.auth));
  const createdWhileClosedId = String(asRecord(createdWhileClosed.announcement).id);
  assert.equal(asRecord(createdWhileClosed.announcement).comments_enabled, false);

  await saveCategoryDraft(admin.auth, { announcementCommentsEnabled: true });
  const manuallyClosedAfterReopen = asRecord(await callAction("getAnnouncement", {
    announcementId,
  }, user.auth));
  assert.equal(asRecord(manuallyClosedAfterReopen.announcement).comments_enabled, false);
  for (const id of [followingId, createdWhileClosedId]) {
    const reopened = asRecord(await callAction("getAnnouncement", { announcementId: id }, user.auth));
    assert.equal(asRecord(reopened.announcement).comments_enabled, true);
    assert.equal(asRecord(reopened.announcement).comments_globally_enabled, true);
  }

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
  await callAction("deleteAnnouncement", {
    announcementId: followingId,
    requestId: requestId("announcement-following-delete"),
  }, manager.auth);
  await callAction("deleteAnnouncement", {
    announcementId: createdWhileClosedId,
    requestId: requestId("announcement-created-while-closed-delete"),
  }, manager.auth);
});
