import { asRecord, assert, callAction, database, drainJobs, integrationTest, notificationStressScale, readFcmRequests, requestId, resetFcmRequests, saveCategoryDraft, seedActor } from "./support.ts";

integrationTest("new proposal and facility notifications are personal to category managers", async () => {
  const admin = await seedActor(`category-notification-admin-${crypto.randomUUID()}`, { roles: ["platform-admin"] });
  const issueCategoryId = `notify-issue-${crypto.randomUUID().slice(0, 8)}`;
  const facilityCategoryId = `notify-facility-${crypto.randomUUID().slice(0, 8)}`;
  await saveCategoryDraft(admin.auth, {
    upsertIssueCategories: [{
      authorVisible: true,
      commentsEnabled: true,
      id: issueCategoryId,
      isDefault: false,
      label: "通知測試提案",
      readAccess: "school",
      responseDeadlineDays: null,
      sortOrder: 20_000,
      supportDeadlineDays: null,
      supportEnabled: false,
      supportGoal: null,
    }],
    upsertFacilityCategories: [{
      id: facilityCategoryId,
      isDefault: false,
      label: "通知測試設備",
      sortOrder: 20_000,
    }],
  });

  const managers = await Promise.all(Array.from({ length: notificationStressScale }, (_, index) => seedActor(
    `category-notification-manager-${index}-${crypto.randomUUID()}`,
    { categoryIds: [issueCategoryId], facilityCategoryIds: [facilityCategoryId] },
  )));
  for (let index = 0; index < managers.length; index += 1) {
    await callAction("registerPushToken", {
      deviceId: `category-notification-device-${index}`,
      permission: "granted",
      platform: "integration",
      token: `category-notification-token-${index}`,
      userAgent: "Category notification integration test",
    }, managers[index].auth);
    await callAction("updatePushNotificationPreferences", {
      deviceId: `category-notification-device-${index}`,
      permission: "granted",
      preferences: {
        comments: true,
        facilityUpdates: index % 3 !== 1,
        issueUpdates: index % 3 !== 2,
      },
    }, managers[index].auth);
  }
  const { error: disableFacilityNotificationError } = await database.table("app_private", "user_facility_category_assignments")
    .update({ notify_on_created: false })
    .eq("uid", managers.at(-1)!.auth.uid)
    .eq("category_id", facilityCategoryId);
  if (disableFacilityNotificationError) throw disableFacilityNotificationError;
  await callAction("setUserAccessScope", {
    grant: true,
    requestId: requestId("notification-preserve-facility-opt-out"),
    scopeKind: "announcement",
    uid: managers.at(-1)!.auth.uid,
  }, admin.auth);
  const { data: preservedOptOut, error: preservedOptOutError } = await database.table("app_private", "user_facility_category_assignments")
    .select("notify_on_created")
    .eq("uid", managers.at(-1)!.auth.uid)
    .eq("category_id", facilityCategoryId)
    .single();
  if (preservedOptOutError) throw preservedOptOutError;
  assert.equal(preservedOptOut.notify_on_created, false);
  await resetFcmRequests();
  const issueAuthor = await seedActor(`category-notification-issue-author-${crypto.randomUUID()}`);
  const facilityAuthor = await seedActor(`category-notification-facility-author-${crypto.randomUUID()}`);
  const issueResult = asRecord(await callAction("createIssue", {
    category: issueCategoryId,
    content: "Category manager proposal notification integration content",
    requestId: requestId("category-notification-issue"),
    title: "Category notification proposal",
  }, issueAuthor.auth));
  const facilityResult = asRecord(await callAction("createFacility", {
    categoryId: facilityCategoryId,
    content: "Category manager facility notification integration content",
    location: "Integration room",
    requestId: requestId("category-notification-facility"),
    title: "Category notification facility",
  }, facilityAuthor.auth));
  const issueId = String(asRecord(issueResult.issue).id);
  const facilityId = String(asRecord(facilityResult.facility).id);

  for (let attempt = 0; attempt < 15; attempt += 1) {
    const { data, error } = await database.table("app_private", "notifications")
      .select("recipient_uid,source,target_id,type").in("target_id", [issueId, facilityId]);
    if (error) throw error;
    if ((data ?? []).length >= managers.length * 2) break;
    await drainJobs();
  }

  const { data: notifications, error: notificationError } = await database.table("app_private", "notifications")
    .select("recipient_uid,source,target_id,type")
    .in("target_id", [issueId, facilityId]);
  if (notificationError) throw notificationError;
  const managerUids = new Set(managers.map((manager) => manager.auth.uid));
  const issueNotifications = (notifications ?? []).filter((row) => row.target_id === issueId);
  const facilityNotifications = (notifications ?? []).filter((row) => row.target_id === facilityId);
  assert.equal(issueNotifications.length, managerUids.size);
  assert.equal(facilityNotifications.length, managerUids.size - 1);
  for (const notification of [...issueNotifications, ...facilityNotifications]) {
    assert.equal(notification.source, "user");
    assert.ok(managerUids.has(String(notification.recipient_uid)));
    assert.notEqual(notification.recipient_uid, admin.auth.uid);
  }
  assert.ok(issueNotifications.every((row) => row.type === "issue_created"));
  assert.ok(facilityNotifications.every((row) => row.type === "facility_report_created"));
  assert.ok(!facilityNotifications.some((row) => row.recipient_uid === managers.at(-1)!.auth.uid));

  const pushRequests = (await readFcmRequests())
    .map((request) => request.body.message)
    .filter((message) => message?.data?.target_id === issueId || message?.data?.target_id === facilityId);
  const issuePushTokens = new Set(pushRequests
    .filter((message) => message?.data?.target_id === issueId)
    .map((message) => message?.token));
  const facilityPushTokens = new Set(pushRequests
    .filter((message) => message?.data?.target_id === facilityId)
    .map((message) => message?.token));
  assert.deepEqual(issuePushTokens, new Set(managers
    .map((_, index) => index)
    .filter((index) => index % 3 !== 2)
    .map((index) => `category-notification-token-${index}`)));
  assert.deepEqual(facilityPushTokens, new Set(managers
    .map((_, index) => index)
    .filter((index) => index !== managers.length - 1 && index % 3 !== 1)
    .map((index) => `category-notification-token-${index}`)));
  assert.ok(pushRequests.some((message) =>
    message?.data?.link === `/issues/${issueCategoryId}/${issueId}`
  ));
  assert.ok(pushRequests.some((message) => message?.data?.link === `/facilities/${facilityId}`));
});
