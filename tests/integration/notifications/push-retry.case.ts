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

  const eventId = crypto.randomUUID();
  const deliveryId = crypto.randomUUID();
  const targetId = crypto.randomUUID();
  const operationId = crypto.randomUUID();
  const moderatorUid = `push-retry-moderator-${crypto.randomUUID()}`;

  const { error: opError } = await database.table("app_private", "operations").insert({
    action: "updateIssueStatus",
    actor_uid: moderatorUid,
    operation_id: operationId,
    response: { seeded: true },
    status: "completed",
  });
  if (opError) throw opError;

  const { error: eventError } = await database.table("app_private", "domain_events").insert({
    actor_uid: moderatorUid,
    aggregate_id: targetId,
    aggregate_type: "issue",
    event_id: eventId,
    event_type: "issue.status_changed",
    operation_id: operationId,
    payload: {
      author_uid: recipient.auth.uid,
      status: "in-progress",
      title: "Retry delivery",
    },
  });
  if (eventError) throw eventError;

  const { error: insertError } = await database.table("app_private", "event_deliveries").insert({
    attempt_count: 0,
    destination: "push",
    event_id: eventId,
    id: deliveryId,
    next_attempt_at: new Date().toISOString(),
    status: "pending",
  });
  if (insertError) throw insertError;

  await drainJobs();
  const { data: failedDelivery, error: failedError } = await database.table("app_private", "event_deliveries")
    .select("attempt_count,status")
    .eq("id", deliveryId)
    .single();
  if (failedError) throw failedError;
  assert.equal(failedDelivery.status, "failed");
  assert.equal(failedDelivery.attempt_count, 1);

  const { error: dueError } = await database.table("app_private", "event_deliveries")
    .update({ next_attempt_at: new Date().toISOString() })
    .eq("id", deliveryId);
  if (dueError) throw dueError;
  await drainJobs();
  const { data: completedDelivery, error: completedError } = await database.table("app_private", "event_deliveries")
    .select("attempt_count,status")
    .eq("id", deliveryId)
    .single();
  if (completedError) throw completedError;
  assert.equal(completedDelivery.status, "completed");
  assert.equal(completedDelivery.attempt_count, 2);

  const attempts = (await readFcmRequests())
    .map((request) => request.body.message)
    .filter((message) => message?.token === token && message.data?.target_id === targetId);
  assert.equal(attempts.length, 2);
});
