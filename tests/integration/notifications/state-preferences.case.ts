import { asRecord, assert, callAction, database, expectActionError, integrationTest, seedActor } from "./support.ts";

integrationTest("notification state, push preferences, and dashboard permissions", async () => {
  const admin = await seedActor("notification-admin", { roles: ["platform-admin"] });
  const user = await seedActor("notification-user");

  await expectActionError(
    "permission-denied",
    () => callAction("listNotificationPages", {
      requests: [{ pageSize: 10, source: "admin" }],
    }, user.auth),
  );
  const pages = asRecord(await callAction("listNotificationPages", {
    requests: [
      { pageSize: 10, source: "broadcast" },
      { pageSize: 10, source: "user" },
    ],
  }, user.auth));
  assert.ok("broadcast" in asRecord(pages.pages));
  assert.ok("user" in asRecord(pages.pages));

  const snapshot = asRecord(await callAction("getNotificationSnapshot", {
    sources: ["broadcast", "user", "admin"],
  }, user.auth));
  assert.ok(!("admin" in asRecord(snapshot.pages)));
  assert.ok(Date.parse(String(snapshot.openedAt)) > 0);

  const state = asRecord(await callAction("getNotificationReadState", {}, user.auth));
  assert.equal(asRecord(state.state).uid, user.auth.uid);
  const unread = asRecord(await callAction("getNotificationUnreadHint", {}, user.auth));
  assert.equal(typeof unread.hasUnread, "boolean");
  const opened = asRecord(await callAction("markNotificationsOpened", {}, user.auth));
  assert.equal(opened.success, true);

  const deviceId = `integration-device-${crypto.randomUUID()}`;
  const token = `integration-token-${crypto.randomUUID()}`;
  const initialPreference = asRecord(await callAction("getPushNotificationPreference", {
    deviceId,
    permission: "default",
  }, user.auth));
  assert.equal(initialPreference.deviceEnabled, false);
  const registered = asRecord(await callAction("registerPushToken", {
    deviceId,
    permission: "granted",
    platform: "integration",
    token,
    userAgent: "Node integration test",
  }, user.auth));
  assert.equal(registered.deviceEnabled, true);
  const { data: registeredToken, error: registeredTokenError } = await database.table("app_private", "push_tokens")
    .select("last_confirmed_at,uid").eq("token", token).single();
  if (registeredTokenError) throw registeredTokenError;
  assert.equal(registeredToken.uid, user.auth.uid);
  assert.ok(Date.parse(registeredToken.last_confirmed_at) > Date.now() - 60_000);
  const updated = asRecord(await callAction("updatePushNotificationPreferences", {
    deviceId,
    permission: "granted",
    preferences: {
      comments: false,
      facilityUpdates: false,
      issueUpdates: true,
    },
  }, user.auth));
  assert.equal(asRecord(updated.personalPreferences).comments, false);
  assert.equal(asRecord(updated.personalPreferences).facilityUpdates, false);
  const unregistered = asRecord(await callAction("unregisterPushToken", {
    deviceId,
    permission: "denied",
  }, user.auth));
  assert.equal(unregistered.deviceEnabled, false);

  const adminDeviceId = `integration-admin-device-${crypto.randomUUID()}`;
  await callAction("registerPushToken", {
    deviceId,
    permission: "granted",
    platform: "integration",
    token,
    userAgent: "Shared device integration test",
  }, user.auth);
  await callAction("registerPushToken", {
    deviceId: adminDeviceId,
    permission: "granted",
    platform: "integration",
    token,
    userAgent: "Shared device integration test",
  }, admin.auth);
  const { data: reassignedTokens, error: reassignedTokenError } = await database.table("app_private", "push_tokens")
    .select("device_id,uid").eq("token", token);
  if (reassignedTokenError) throw reassignedTokenError;
  assert.deepEqual(reassignedTokens, [{ device_id: adminDeviceId, uid: admin.auth.uid }]);
  await callAction("unregisterPushToken", {
    deviceId: adminDeviceId,
    permission: "denied",
  }, admin.auth);

  await expectActionError(
    "permission-denied",
    () => callAction("getPlatformDashboard", {}, user.auth),
  );
  const dashboard = asRecord(await callAction("getPlatformDashboard", {}, admin.auth));
  assert.ok("stats" in dashboard);
  assert.ok("operations" in dashboard);
});
