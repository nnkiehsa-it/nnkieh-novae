import { asRecord, assert, authenticatedJwt, callAction, createClient, DATA_RETENTION, expectActionError, failNextFcmRequests, integrationTest, notificationStressScale, readFcmRequests, requestId, requiredEnv, resetFcmRequests, saveCategoryDraft, seedActor, supabase } from "./support.ts";
import type { Database } from "./support.ts";

integrationTest("announcement and nested comment notifications cover broadcast, personal, and push routing", async () => {
  const manager = await seedActor(`notification-announcement-manager-${crypto.randomUUID()}`, {
    roles: ["announcement-manager"],
  });
  const commenter = await seedActor(`notification-announcement-commenter-${crypto.randomUUID()}`);
  const replier = await seedActor(`notification-announcement-replier-${crypto.randomUUID()}`);
  for (const [index, actor] of [manager, commenter].entries()) {
    await callAction("registerPushToken", {
      deviceId: `announcement-notification-device-${index}`,
      permission: "granted",
      platform: "integration",
      token: `announcement-notification-token-${index}`,
      userAgent: "Announcement notification integration test",
    }, actor.auth);
  }
  await callAction("updatePushNotificationPreferences", {
    deviceId: "announcement-notification-device-0",
    permission: "granted",
    preferences: { comments: false, facilityUpdates: true, issueUpdates: true },
  }, manager.auth);
  await resetFcmRequests();

  const created = asRecord(await callAction("createAnnouncement", {
    content: "Notification routing announcement content",
    requestId: requestId("notification-announcement"),
    title: "Notification routing",
  }, manager.auth));
  const announcementId = String(asRecord(created.announcement).id);
  const root = asRecord(await callAction("createAnnouncementComment", {
    announcementId,
    content: "Root announcement notification comment",
    requestId: requestId("notification-announcement-root"),
  }, commenter.auth));
  const rootCommentId = String(asRecord(root.comment).id);
  const reply = asRecord(await callAction("createAnnouncementComment", {
    announcementId,
    content: "Nested announcement notification reply",
    parentCommentId: rootCommentId,
    requestId: requestId("notification-announcement-reply"),
  }, replier.auth));
  const replyCommentId = String(asRecord(reply.comment).id);

  const workerUrl = `${requiredEnv("SUPABASE_FUNCTIONS_URL").replace(/\/+$/u, "")}/outboxWorker`;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const { data, error } = await supabase.schema("app_private").from("notifications")
      .select("comment_id,recipient_uid,source,type")
      .eq("target_id", announcementId);
    if (error) throw error;
    if ((data ?? []).some((row) => row.type === "announcement_created")
      && (data ?? []).some((row) => row.comment_id === rootCommentId)
      && (data ?? []).some((row) => row.comment_id === replyCommentId)) break;
    const response = await fetch(workerUrl, {
      headers: {
        authorization: `Bearer ${requiredEnv("WEBHOOK_SECRET")}`,
        "x-novae-origin-secret": requiredEnv("EDGE_ORIGIN_SECRET"),
      },
      method: "POST",
    });
    assert.ok(response.ok || response.status === 429, `outbox worker returned ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 550));
  }

  const { data: rows, error: rowError } = await supabase.schema("app_private").from("notifications")
    .select("comment_id,recipient_uid,source,type")
    .eq("target_id", announcementId);
  if (rowError) throw rowError;
  const broadcast = (rows ?? []).find((row) => row.type === "announcement_created");
  assert.equal(broadcast?.source, "broadcast");
  assert.equal(broadcast?.recipient_uid, null);
  assert.ok((rows ?? []).some((row) =>
    row.comment_id === rootCommentId && row.recipient_uid === manager.auth.uid
  ));
  assert.ok((rows ?? []).some((row) =>
    row.comment_id === replyCommentId && row.recipient_uid === commenter.auth.uid
  ));

  const messages = (await readFcmRequests()).map((request) => request.body.message).filter(Boolean);
  assert.ok(messages.some((message) =>
    message?.topic === "srp-broadcast"
    && message.data?.target_id === announcementId
    && message.data?.link === `/announcements/${announcementId}`
  ));
  assert.ok(!messages.some((message) =>
    message?.token === "announcement-notification-token-0"
    && message.data?.comment_id === rootCommentId
  ));
  assert.ok(messages.some((message) =>
    message?.token === "announcement-notification-token-1"
    && message.data?.comment_id === replyCommentId
    && message.data?.link === `/announcements/${announcementId}?tab=comments&comment=${replyCommentId}`
  ));
});
