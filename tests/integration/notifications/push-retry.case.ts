import { assert, callAction, database, drainJobs, failNextFcmRequests, insertRows, integrationTest, readFcmRequests, resetFcmRequests, seedActor } from "./support.ts";

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

  await insertRows("operations", [{
    action: "updateIssueStatus",
    actor_uid: moderatorUid,
    operation_id: operationId,
    response: { seeded: true },
    status: "completed",
  }]);

  await insertRows("domain_events", [{
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
  }]);

  await insertRows("event_deliveries", [{
    attempt_count: 0,
    destination: "push",
    event_id: eventId,
    id: deliveryId,
    next_attempt_at: new Date().toISOString(),
    status: "pending",
  }]);

  const deliveryState = async () => await database.sqlOne<{ attempt_count: number; status: string }>`
    select attempt_count, status from app_private.event_deliveries where id = ${deliveryId}`;

  await drainJobs();
  const failedDelivery = await deliveryState();
  assert.equal(failedDelivery.status, "failed");
  assert.equal(failedDelivery.attempt_count, 1);

  await database.sql`update app_private.event_deliveries
    set next_attempt_at = ${new Date().toISOString()} where id = ${deliveryId}`;
  await drainJobs();
  const completedDelivery = await deliveryState();
  assert.equal(completedDelivery.status, "completed");
  assert.equal(completedDelivery.attempt_count, 2);

  const attempts = (await readFcmRequests())
    .map((request) => request.body.message)
    .filter((message) => message?.token === token && message.data?.target_id === targetId);
  assert.equal(attempts.length, 2);
});
