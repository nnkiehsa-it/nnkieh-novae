import assert from "node:assert/strict";
import { vi } from "vitest";
import { callAction, database, insertRows, integrationTest, seedActor, underPolicies } from "./helpers.ts";
import { processPushDeliveries } from "../../cloudflare/src/backend/jobs/notification-deliveries.ts";
import * as fcm from "../../cloudflare/src/backend/shared/fcm.ts";

integrationTest("partial push retries skip successfully delivered devices", async () => {
  const recipient = await seedActor("push-progress");
  for (const token of ["a", "b", "c"]) {
    await callAction("registerPushToken", { deviceId: token, permission: "granted", platform: "integration", token, userAgent: "test" }, recipient.auth);
  }
  const eventId = crypto.randomUUID(), deliveryId = crypto.randomUUID(), operationId = crypto.randomUUID();
  await insertRows("operations", [{ action: "moderateIssueStatus", actor_uid: "moderator", operation_id: operationId, response: {}, status: "completed" }]);
  await insertRows("domain_events", [{ actor_uid: "moderator", aggregate_id: crypto.randomUUID(), aggregate_type: "issue", event_id: eventId, event_type: "issue.status_changed", operation_id: operationId, payload: { author_uid: recipient.auth.uid, new_status: "processing", title: "Progress" } }]);
  await insertRows("event_deliveries", [{ destination: "push", event_id: eventId, id: deliveryId }]);
  const drain = () => underPolicies(() => processPushDeliveries(database));
  let failed = false;
  const sent: string[] = [];
  const send = vi.spyOn(fcm, "sendFcmMessage").mockImplementation(async (message) => {
    sent.push(String(message.token));
    if (message.token === "c" && !failed) { failed = true; throw new Error("temporary FCM failure"); }
    return {};
  });
  try {
    await drain();
    assert.deepEqual(sent, ["a", "b", "c"]);
    const receipts = await database.sql`select token_hash from app_private.push_delivery_receipts where delivery_id=${deliveryId}`;
    assert.equal(receipts.rows.length, 2);
    await database.sql`update app_private.event_deliveries set next_attempt_at=now() where id=${deliveryId}`;
    await drain();
    assert.deepEqual(sent, ["a", "b", "c", "c"]);
    const result = await database.sqlOne<{status:string}>`select status from app_private.event_deliveries where id=${deliveryId}`;
    assert.equal(result.status, "completed");
    await database.sql`delete from app_private.event_deliveries where id=${deliveryId}`;
    assert.equal((await database.sql`select token_hash from app_private.push_delivery_receipts where delivery_id=${deliveryId}`).rows.length, 0);
  } finally { send.mockRestore(); }
});
