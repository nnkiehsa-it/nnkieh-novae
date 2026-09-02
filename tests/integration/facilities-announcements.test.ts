import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  expectActionError,
  integrationTest,
  saveCategoryDraft,
  seedActor,
  database,
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
  const facilityCategoryId = String(facility.categoryId);
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
  assert.ok(
    (list.facilities as Array<Record<string, unknown>>).every((row) => row.categoryId === facilityCategoryId),
    JSON.stringify({ facilityCategoryId, facilities: list.facilities }),
  );
  assert.equal(typeof list.version, "number");

  const affected = asRecord(await callAction("toggleFacilityAffected", {
    facilityId,
  }, user.auth));
  assert.equal(affected.affected, true);

  await expectActionError(
    "permission-denied",
    () => callAction("updateFacilityStatus", {
      facilityId,
      status: "processing",
    }, owner.auth),
  );
  await expectActionError(
    "permission-denied",
    () => callAction("updateFacilityStatus", {
      facilityId,
      status: "processing",
    }, wrongCategoryManager.auth),
  );
  const processing = asRecord(await callAction("updateFacilityStatus", {
    facilityId,
    status: "processing",
  }, manager.auth));
  assert.equal(asRecord(processing.facility).status, "processing");
  await expectActionError(
    "missing-result",
    () => callAction("updateFacilityStatus", {
      facilityId,
      status: "completed",
    }, manager.auth),
  );
  const completed = asRecord(await callAction("updateFacilityStatus", {
    facilityId,
    resultContent: "Facility handled",
    status: "completed",
  }, manager.auth));
  assert.equal(asRecord(completed.facility).status, "completed");
  await callAction("deleteFacility", {
    facilityId,
  }, manager.auth);

  const ownerDelete = await createFacility(owner, "owner-delete");
  const ownerDeleteId = String(ownerDelete.id);
  await expectActionError(
    "permission-denied",
    () => callAction("deleteFacility", {
      facilityId: ownerDeleteId,
    }, user.auth),
  );
  await callAction("deleteFacility", {
    facilityId: ownerDeleteId,
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
      title: "Denied",
    }, user.auth),
  );
  const created = asRecord(await callAction("createAnnouncement", {
    content: "Integration announcement content",
    title: "Integration announcement",
  }, manager.auth));
  const announcementId = String(asRecord(created.announcement).id);

  const list = asRecord(await callAction("listAnnouncements", {
    pageSize: 30,
  }, user.auth));
  const listedAnnouncement = (list.announcements as Array<Record<string, unknown>>)
    .find((announcement) => announcement.id === announcementId);
  assert.ok(listedAnnouncement);
  assert.equal("content" in listedAnnouncement, false);
  assert.equal(typeof list.version, "number");
  const read = asRecord(await callAction("getAnnouncement", {
    announcementId,
  }, user.auth));
  assert.equal(asRecord(read.announcement).id, announcementId);
  assert.equal(asRecord(read.announcement).content, "Integration announcement content");

  const likeOperationId = crypto.randomUUID();
  const liked = asRecord(await callAction("setAnnouncementLike", {
    announcementId,
    liked: true,
  }, user.auth, likeOperationId));
  assert.equal(liked.liked, true);
  const repeatedLike = asRecord(await callAction("setAnnouncementLike", {
    announcementId,
    liked: true,
  }, user.auth, likeOperationId));
  assert.equal(repeatedLike.liked, true);
  assert.equal(repeatedLike.likeCount, liked.likeCount);
  const { count: likeOperationWrites, error: likeOpError } = await database
    .table("app_private", "operations").select("operation_id", { count: "exact", head: true })
    .eq("actor_uid", user.auth.uid).eq("action", "setAnnouncementLike").eq("operation_id", likeOperationId);
  if (likeOpError) throw likeOpError;
  assert.equal(likeOperationWrites, 1);
  const unliked = asRecord(await callAction("setAnnouncementLike", {
    announcementId,
    liked: false,
  }, user.auth));
  assert.equal(unliked.liked, false);

  const commentWrite = asRecord(await callAction("createAnnouncementComment", {
    announcementId,
    content: "Integration announcement comment",
  }, user.auth));
  const commentId = String(asRecord(commentWrite.comment).id);
  const secondCommentWrite = asRecord(await callAction("createAnnouncementComment", {
    announcementId,
    content: "Second integration announcement comment",
  }, user.auth));
  const secondCommentId = String(asRecord(secondCommentWrite.comment).id);
  const comments = asRecord(await callAction("listAnnouncementComments", {
    announcementId,
    pageSize: 30,
    sort: "newest",
  }, stranger.auth));
  assert.ok(JSON.stringify(comments).includes(commentId));
  assert.equal(typeof comments.version, "number");
  const newestIds = (comments.comments as Array<Record<string, unknown>>).map((comment) => String(comment.id));
  const oldestComments = asRecord(await callAction("listAnnouncementComments", {
    announcementId,
    pageSize: 30,
    sort: "oldest",
  }, stranger.auth));
  const oldestIds = (oldestComments.comments as Array<Record<string, unknown>>).map((comment) => String(comment.id));
  assert.deepEqual(oldestIds, [...newestIds].reverse());
  await expectActionError(
    "permission-denied",
    () => callAction("deleteAnnouncementComment", {
      commentId,
    }, stranger.auth),
  );
  await callAction("deleteAnnouncementComment", {
    commentId,
  }, user.auth);
  await callAction("deleteAnnouncementComment", {
    commentId: secondCommentId,
  }, user.auth);

  const managedCommentWrite = asRecord(await callAction("createAnnouncementComment", {
    announcementId,
    content: "Manager removable announcement comment",
  }, stranger.auth));
  await callAction("deleteAnnouncementComment", {
    commentId: String(asRecord(managedCommentWrite.comment).id),
  }, manager.auth);

  const following = asRecord(await callAction("createAnnouncement", {
    content: "Follows the global announcement comment setting",
    title: "Global setting follower",
  }, manager.auth));
  const followingId = String(asRecord(following.announcement).id);

  await saveCategoryDraft(admin.auth, { announcementCommentsEnabled: false });
  for (const id of [announcementId, followingId]) {
    const globallyClosed = asRecord(await callAction("getAnnouncement", {
      announcementId: id,
    }, user.auth));
    assert.equal(asRecord(globallyClosed.announcement).commentsEnabled, false);
  }
  await expectActionError(
    "comments-disabled",
    () => callAction("createAnnouncementComment", {
      announcementId: followingId,
      content: "Must be rejected by the global setting",
    }, stranger.auth),
  );
  const createdWhileClosed = asRecord(await callAction("createAnnouncement", {
    content: "Created while global comments are closed",
    title: "Created while closed",
  }, manager.auth));
  const createdWhileClosedId = String(asRecord(createdWhileClosed.announcement).id);
  assert.equal(asRecord(createdWhileClosed.announcement).commentsEnabled, false);

  await saveCategoryDraft(admin.auth, { announcementCommentsEnabled: true });
  const reopenedAfterGlobalSetting = asRecord(await callAction("getAnnouncement", {
    announcementId,
  }, user.auth));
  assert.equal(asRecord(reopenedAfterGlobalSetting.announcement).commentsEnabled, true);
  for (const id of [followingId, createdWhileClosedId]) {
    const reopened = asRecord(await callAction("getAnnouncement", { announcementId: id }, user.auth));
    assert.equal(asRecord(reopened.announcement).commentsEnabled, true);
  }

  await expectActionError(
    "permission-denied",
    () => callAction("deleteAnnouncement", {
      announcementId,
    }, user.auth),
  );
  await callAction("deleteAnnouncement", {
    announcementId,
  }, manager.auth);
  await callAction("deleteAnnouncement", {
    announcementId: followingId,
  }, manager.auth);
  await callAction("deleteAnnouncement", {
    announcementId: createdWhileClosedId,
  }, manager.auth);
});
