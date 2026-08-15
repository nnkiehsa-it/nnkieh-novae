import { assert, callAction, database, drainJobs, failNextFcmRequests, integrationTest, readFcmRequests, resetFcmRequests, seedActor } from "./support.ts";

integrationTest("transient FCM failures persist and retry without losing the push", async () => {
  const recipient = await seedActor(`push-retry-recipient-${crypto.randomUUID()}`);
  const token = `push-retry-token-${crypto.randomUUID()}`;
  const deviceId = `push-retry-device-${crypto.randomUUID()}`;
  await callAction("registerPushToken", {
    deviceId,
    permission: "granted",
    platform: "integration",
    token,
    userAgent: "Push retry integration test",
  }, recipient.auth);
  await resetFcmRequests();
  await failNextFcmRequests(1);

  const deliveryId = crypto.randomUUID();
  const deliveryKey = `integration-push-retry-${crypto.randomUUID()}`;
  const targetId = crypto.randomUUID();
  const notification = {
    body_preview: "Temporary delivery failure",
    issue_category: "public-issues",
    source: "user",
    target_id: targetId,
    target_type: "issue",
    title: "Retry delivery",
    type: "issue_status_changed",
  };
  const { error: insertError } = await database.table("app_private", "push_delivery_logs").insert({
    attempt_count: 0,
    delivery_key: deliveryKey,
    id: deliveryId,
    next_attempt_at: new Date().toISOString(),
    notification,
    notification_type: notification.type,
    recipient_uids: [recipient.auth.uid],
    status: "failed",
    target_id: targetId,
    target_type: "issue",
    token_uid: recipient.auth.uid,
  });
  if (insertError) throw insertError;

  await drainJobs();
  const { data: failedDelivery, error: failedError } = await database.table("app_private", "push_delivery_logs")
    .select("attempt_count,notification,status")
    .eq("id", deliveryId)
    .single();
  if (failedError) throw failedError;
  assert.equal(failedDelivery.status, "failed");
  assert.equal(failedDelivery.attempt_count, 1);
  assert.ok(failedDelivery.notification);

  const { error: dueError } = await database.table("app_private", "push_delivery_logs")
    .update({ next_attempt_at: new Date().toISOString() })
    .eq("id", deliveryId);
  if (dueError) throw dueError;
  await drainJobs();
  const { data: completedDelivery, error: completedError } = await database.table("app_private", "push_delivery_logs")
    .select("attempt_count,notification,recipient_uids,status")
    .eq("id", deliveryId)
    .single();
  if (completedError) throw completedError;
  assert.equal(completedDelivery.status, "sent");
  assert.equal(completedDelivery.attempt_count, 2);
  assert.equal(completedDelivery.notification, null);
  assert.deepEqual(completedDelivery.recipient_uids, []);

  const attempts = (await readFcmRequests())
    .map((request) => request.body.message)
    .filter((message) => message?.token === token && message.data?.target_id === targetId);
  assert.equal(attempts.length, 2);
});
