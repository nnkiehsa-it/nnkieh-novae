import { asRecord, assert, callAction, database, drainJobs, integrationTest, saveCategoryDraft, seedActor } from "./support.ts";

integrationTest("a proposal's status change tells its author what changed", async () => {
  const admin = await seedActor(`status-change-admin-${crypto.randomUUID()}`, { roles: ["platform-admin"] });
  const author = await seedActor(`status-change-author-${crypto.randomUUID()}`);
  const categoryId = `status-change-${crypto.randomUUID().slice(0, 8)}`;
  await saveCategoryDraft(admin.auth, {
    upsertIssueCategories: [{
      authorVisible: true,
      commentsEnabled: true,
      id: categoryId,
      isDefault: false,
      label: "狀態通知測試",
      readAccess: "school",
      sortOrder: 20_100,
      supportDeadlineDays: null,
      supportEnabled: false,
      supportGoal: null,
    }],
  });

  const title = `Status ${crypto.randomUUID().slice(0, 8)}`;
  const created = asRecord(await callAction("createIssue", {
    category: categoryId,
    content: "Status change notification integration content",
    title,
  }, author.auth));
  const issueId = String(asRecord(created.issue).id);

  await callAction("moderateIssueStatus", { issueId, status: "processing" }, admin.auth);

  let notification: Record<string, unknown> | undefined;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const { rows } = await database.sql`
      select body_preview, issue_category, new_status, old_status, recipient_uid, title, type
      from app_private.notifications
      where target_id = ${issueId} and type = 'issue_status_changed'`;
    notification = rows.find((row) => row.recipient_uid === author.auth.uid);
    if (notification) break;
    await drainJobs();
  }

  assert.ok(notification, "the author is told their proposal changed status");
  assert.equal(notification.new_status, "processing");
  assert.equal(notification.old_status, "pending");
  assert.equal(notification.issue_category, categoryId);
  assert.ok(
    String(notification.body_preview).includes(title),
    `the notification names the proposal: ${String(notification.body_preview)}`,
  );
});
