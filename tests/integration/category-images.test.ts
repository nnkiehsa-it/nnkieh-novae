import assert from "node:assert/strict";
import { asRecord, callAction, database, insertReadyUpload, integrationTest, saveCategoryDraft, seedActor, tableRow } from "./helpers.ts";

const metadata = { contentType: "image/webp", height: 64, size: 256, width: 64 };
const markdown = (id: string) => `![image|64x64](srp-upload://${id})`;

integrationTest("category image limits apply to sessions, actual comment parents and final writes", async () => {
  const admin = await seedActor("media-admin", { roles: ["platform-admin"] });
  const member = await seedActor("media-member");
  await saveCategoryDraft(admin.auth, {
    upsertIssueCategories: [
      { id: "proposal-a", maxImages: 0, commentMaxImages: 0 },
      { id: "proposal-b", maxImages: 2, commentMaxImages: 2 },
    ],
    upsertFacilityCategories: [{ id: "general", maxImages: 0 }],
    announcementMaxImages: 0, announcementCommentMaxImages: 2,
  });
  const bootstrap = asRecord(await callAction("getSessionBootstrap", { recordVisit: false }, member.auth));
  const catalog = asRecord(bootstrap.catalog);
  assert.equal(asRecord((catalog.issueCategories as unknown[]).find((item) => asRecord(item).id === "proposal-a")).maxImages, 0);
  assert.equal(asRecord(catalog.features).announcementCommentMaxImages, 2);
  assert.equal("issueMaxImages" in asRecord(catalog.imageUploads), false);
  for (const [targetType, scopeId] of [["issue", "proposal-a"], ["facility", "general"], ["announcement", ""]]) {
    await assert.rejects(() => callAction("createImageUploadSessions", { targetType, scopeId, images: [metadata] }, member.auth), /validation-too-many/);
  }
  const upload = await insertReadyUpload(member.auth.uid, "category-policy");
  await assert.rejects(() => callAction("createIssue", { category: "proposal-a", title: "Disabled images", content: markdown(upload.id) }, member.auth), /validation-too-many/);
  await assert.rejects(() => callAction("createIssue", { category: "proposal-a", title: "Hidden upload reference", content: `srp-upload://${upload.id}` }, member.auth), /validation-too-many/);
  await assert.rejects(() => callAction("createFacility", { categoryId: "general", title: "Disabled images", location: "Room", content: markdown(upload.id) }, member.auth), /validation-too-many/);
  await assert.rejects(() => callAction("createAnnouncement", { title: "Disabled images", content: markdown(upload.id) }, admin.auth), /validation-too-many/);
  const parent = asRecord(asRecord(await callAction("createIssue", { category: "proposal-a", title: "Text allowed", content: "Body" }, member.auth)).issue);
  await assert.rejects(() => callAction("createImageUploadSessions", { targetType: "comment", scopeId: parent.id, categoryId: "proposal-b", images: [metadata] }, member.auth), /validation-too-many/);
  await assert.rejects(() => callAction("createComment", { issueId: parent.id, content: markdown(upload.id) }, member.auth), /validation-too-many/);

  const allowed = asRecord(asRecord(await callAction("createIssue", { category: "proposal-b", title: "Images allowed", content: "Body" }, member.auth)).issue);
  await callAction("createImageUploadSessions", { targetType: "comment", scopeId: allowed.id, images: [metadata, metadata] }, member.auth);
  await assert.rejects(() => callAction("createImageUploadSessions", { targetType: "comment", scopeId: allowed.id, images: [metadata, metadata, metadata] }, member.auth), /validation-too-many/);
  const comment = asRecord(asRecord(await callAction("createComment", { issueId: allowed.id, content: markdown(upload.id) }, member.auth)).comment);
  assert.ok(comment.id);
  assert.equal((await tableRow("uploads", "id", upload.id))?.attached_target_id, comment.id);

  // A ready upload cannot bypass a subsequently disabled policy, including finalization.
  const lateMember = await seedActor("media-after-policy-change");
  const pending = await insertReadyUpload(lateMember.auth.uid, "changed-policy");
  await saveCategoryDraft(admin.auth, { upsertIssueCategories: [{ id: "proposal-b", commentMaxImages: 0 }] });
  await assert.rejects(() => callAction("finalizeImageUploads", { targetType: "comment", scopeId: allowed.id, uploads: [{ uploadId: pending.id }] }, lateMember.auth), /validation-too-many/);
  await assert.rejects(() => callAction("createComment", { issueId: allowed.id, content: markdown(pending.id) }, lateMember.auth), /validation-too-many/);
  assert.equal((await tableRow("uploads", "id", upload.id))?.attached_target_id, comment.id, "existing media stays attached");
});

integrationTest("announcement comment limits are independent and invalid policy changes roll back", async () => {
  const admin = await seedActor("announcement-media-admin", { roles: ["platform-admin"] });
  const member = await seedActor("announcement-media-member");
  await saveCategoryDraft(admin.auth, { announcementMaxImages: 3, announcementCommentMaxImages: 0 });
  const announcement = asRecord(asRecord(await callAction("createAnnouncement", { title: "Notice", content: "Body" }, admin.auth)).announcement);
  const upload = await insertReadyUpload(member.auth.uid, "announcement-comment");
  await assert.rejects(() => callAction("createAnnouncementComment", { announcementId: announcement.id, content: markdown(upload.id) }, member.auth), /validation-too-many/);
  await saveCategoryDraft(admin.auth, { announcementCommentMaxImages: 1 });
  await callAction("createAnnouncementComment", { announcementId: announcement.id, content: markdown(upload.id) }, member.auth);
  await assert.rejects(() => saveCategoryDraft(admin.auth, { announcementMaxImages: 21, upsertIssueCategories: [{ id: "proposal-a", maxImages: 0 }] }), /validation-required/);
  const category = await database.sqlOne<{ max_images: number }>`select max_images from app_private.issue_categories where id='proposal-a'`;
  assert.equal(category.max_images, 2);
  await assert.rejects(() => saveCategoryDraft(admin.auth, { upsertIssueCategories: [{ id: "proposal-a", maxImages: 1.5 }] }), /validation-required/);
});
