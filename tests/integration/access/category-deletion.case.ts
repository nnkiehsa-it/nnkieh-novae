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

integrationTest("category deletion removes category and all associated resources, queueing cloudinary deletion and outbox events", async () => {
  const admin = await seedActor("delete-cat-admin", { roles: ["platform-admin"] });
  const user = await seedActor("delete-cat-user");

  const managementBefore = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  const issueCats = managementBefore.issueCategories as unknown[];

  const defaultIssueCat = asRecord(issueCats.find(c => asRecord(c).isDefault));
  assert.ok(defaultIssueCat, "Should find a default issue category");

  // 1. Try to delete default category - expect error
  const remainingIssueCategories = issueCats
    .filter((category) => asRecord(category).id !== defaultIssueCat.id)
    .map((category, index) => ({ ...asRecord(category), isDefault: index === 0, sortOrder: index }));
  const { error: defaultDeleteError } = await supabase.schema("app_api")
    .rpc("backend_save_category_management", {
      actor_uid: admin.auth.uid,
      deleted_facility_category_ids: [],
      deleted_issue_category_ids: [String(defaultIssueCat.id)],
      facilities_enabled: Boolean(asRecord(managementBefore.features).facilitiesEnabled),
      facility_categories: managementBefore.facilityCategories,
      issue_categories: remainingIssueCategories,
      issues_enabled: true,
    });
  assert.match(defaultDeleteError?.message ?? "", /cannot-delete-default-category/u);

  // 2. Create a temporary category to delete
  await saveCategoryDraft(admin.auth, {
    upsertIssueCategories: [{
      id: "temp-cat-to-delete",
      label: "臨時分類",
      readAccess: "school",
      authorVisible: true,
      supportEnabled: true,
      supportGoal: 10,
      supportDeadlineDays: 30,
      responseDeadlineDays: null,
      commentsEnabled: true,
      isDefault: false,
      sortOrder: 99,
    }],
  });
  const { error: archiveAttemptError } = await supabase.schema("app_private").from("issue_categories")
    .update({ is_active: false }).eq("id", "temp-cat-to-delete");
  assert.ok(archiveAttemptError, "database must reject attempts to archive a retained category");
  assert.equal((await tableRow("issue_categories", "id", "temp-cat-to-delete"))?.is_active, true);

  // 3. User tries to delete temporary category - expect permission-denied
  await expectActionError("permission-denied", () => saveCategoryDraft(user.auth, {
    deletedIssueCategoryIds: ["temp-cat-to-delete"],
  }));

  // 4. Create an issue in temporary category to verify cascade deletion
  const upload = await insertReadyUpload(user.auth.uid, "category-hard-delete");
  const issuePayload = {
    title: "測試提案案件",
    content: `這是一個測試提案\n\n![測試圖片](srp-upload://${upload.id})`,
    category: "temp-cat-to-delete",
    authorName: "測試者",
    requestId: requestId("create-issue-to-delete"),
  };
  const createdIssue = asRecord(await callAction("createIssue", issuePayload, user.auth));
  const issueId = asRecord(createdIssue.issue).id;
  assert.ok(issueId);

  const commentResult = asRecord(await callAction("createComment", {
    content: "分類刪除時也必須移除此留言",
    issueId: String(issueId),
    requestId: requestId("create-comment-to-delete"),
  }, user.auth));
  const commentId = String(asRecord(commentResult.comment).id);
  const supporter = await seedActor("delete-cat-supporter");
  await callAction("toggleSupport", {
    issueId: String(issueId),
    requestId: requestId("create-support-to-delete"),
  }, supporter.auth);
  const notificationId = crypto.randomUUID();
  const { error: notificationError } = await supabase.schema("app_private").from("notifications").insert({
    id: notificationId,
    recipient_uid: user.auth.uid,
    source: "user",
    target_id: String(issueId),
    target_type: "issue",
    title: "分類刪除測試通知",
    type: "issue.updated",
  });
  if (notificationError) throw notificationError;

  assert.ok(await tableRow("comments", "id", commentId));
  assert.ok(await tableRow("supports", "issue_id", String(issueId)));
  assert.ok(await tableRow("uploads", "id", upload.id));
  assert.ok(await tableRow("notifications", "id", notificationId));

  // 5. Admin deletes temporary category
  const res = asRecord(await saveCategoryDraft(admin.auth, {
    deletedIssueCategoryIds: ["temp-cat-to-delete"],
  }));
  assert.equal(res.success, true);

  // 6. Verify temporary category is gone
  const managementAfter = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  const issueCatsAfter = managementAfter.issueCategories as unknown[];
  assert.equal(issueCatsAfter.some(c => asRecord(c).id === "temp-cat-to-delete"), false);

  // 7. Verify issue is cascade deleted
  assert.equal(await tableRow("issues", "id", String(issueId)), null);
  assert.equal(await tableRow("comments", "id", commentId), null);
  assert.equal(await tableRow("supports", "issue_id", String(issueId)), null);
  assert.equal(await tableRow("uploads", "id", upload.id), null);
  assert.equal(await tableRow("notifications", "id", notificationId), null);
  assert.ok(await tableRow("deletion_jobs", "cloudinary_public_id", upload.cloudinaryPublicId));

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

  await expectActionError("not-found", () => saveCategoryDraft(admin.auth, {
    deletedIssueCategoryIds: ["temp-cat-to-delete"],
  }));

  const { data: deletionAudit, error: deletionAuditError } = await supabase.schema("app_private")
    .from("category_configuration_audit").select("domain,category_id,operation,actor_uid")
    .eq("category_id", "temp-cat-to-delete").eq("operation", "delete");
  if (deletionAuditError) throw deletionAuditError;
  assert.equal(deletionAudit.length, 1);
  assert.equal(deletionAudit[0]?.actor_uid, admin.auth.uid);

  await saveCategoryDraft(admin.auth, {
    upsertFacilityCategories: [{
      id: "temp-facility-to-delete",
      isDefault: false,
      label: "臨時設備分類",
      sortOrder: 99,
    }],
  });
  const facilityUpload = await insertReadyUpload(user.auth.uid, "facility-category-hard-delete");
  const facilityResult = asRecord(await callAction("createFacility", {
    categoryId: "temp-facility-to-delete",
    content: `設備分類刪除測試\n\n![測試圖片](srp-upload://${facilityUpload.id})`,
    location: "測試位置",
    requestId: requestId("create-facility-to-delete"),
    title: "測試設備案件",
  }, user.auth));
  const facilityId = String(asRecord(facilityResult.facility).id);
  await callAction("toggleFacilityAffected", {
    facilityId,
    requestId: requestId("create-facility-affected-to-delete"),
  }, supporter.auth);
  const facilityNotificationId = crypto.randomUUID();
  const { error: facilityNotificationError } = await supabase.schema("app_private").from("notifications").insert({
    id: facilityNotificationId,
    recipient_uid: user.auth.uid,
    source: "user",
    target_id: facilityId,
    target_type: "facility",
    title: "設備分類刪除測試通知",
    type: "facility.updated",
  });
  if (facilityNotificationError) throw facilityNotificationError;
  assert.ok(await tableRow("facility_report_affected_users", "facility_id", facilityId));

  const facilityDelete = asRecord(await saveCategoryDraft(admin.auth, {
    deletedFacilityCategoryIds: ["temp-facility-to-delete"],
  }));
  assert.equal(facilityDelete.success, true);
  assert.equal(await tableRow("facility_reports", "id", facilityId), null);
  assert.equal(await tableRow("facility_report_affected_users", "facility_id", facilityId), null);
  assert.equal(await tableRow("uploads", "id", facilityUpload.id), null);
  assert.equal(await tableRow("notifications", "id", facilityNotificationId), null);
  assert.ok(await tableRow("deletion_jobs", "cloudinary_public_id", facilityUpload.cloudinaryPublicId));

  const { data: facilityOutbox, error: facilityOutboxError } = await supabase.schema("app_private")
    .from("outbox_events").select("event_type").eq("target_id", facilityId).eq("event_type", "facility.deleted");
  if (facilityOutboxError) throw facilityOutboxError;
  assert.equal(facilityOutbox.length, 1);
});
