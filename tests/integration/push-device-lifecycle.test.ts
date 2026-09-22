import assert from "node:assert/strict";
import { callAction, database, integrationTest, seedActor } from "./helpers.ts";

integrationTest("unregisterPushToken removes only the signed-in account's device", async () => {
  const first = await seedActor("push-first"), second = await seedActor("push-second");
  for (const [auth, deviceId, token] of [[first.auth, "shared-device", "first-token"], [first.auth, "other-device", "other-token"], [second.auth, "shared-device", "second-token"]] as const) {
    await callAction("registerPushToken", { deviceId, token, permission: "granted", platform: "test", userAgent: "test" }, auth);
  }
  await callAction("unregisterPushToken", { deviceId: "shared-device" }, first.auth);
  const { rows } = await database.sql<{uid:string;device_id:string}>`select uid,device_id from app_private.push_tokens`;
  assert.equal(rows.length, 2);
  assert.ok(rows.some((row) => row.uid === second.auth.uid && row.device_id === "shared-device"));
  assert.ok(rows.some((row) => row.uid === first.auth.uid && row.device_id === "other-device"));
  await callAction("unregisterPushToken", { deviceId: "shared-device" }, first.auth);
  assert.equal((await database.sql`select uid from app_private.push_tokens`).rows.length, 2);
});
