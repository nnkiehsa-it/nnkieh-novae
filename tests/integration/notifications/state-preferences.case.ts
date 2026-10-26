import { asRecord, assert, callAction, database, expectActionError, integrationTest, seedActor } from "./support.ts";

integrationTest("notification state, mandatory push, admin preferences, and dashboard permissions", async () => {
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
  assert.ok("userOpenedAt" in asRecord(state.state));
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
  const registeredToken = await database.sqlOne<{ last_confirmed_at: string; uid: string }>`
    select last_confirmed_at, uid from app_private.push_tokens where token = ${token}`;
  assert.equal(registeredToken.uid, user.auth.uid);
  assert.ok(Date.parse(registeredToken.last_confirmed_at) > Date.now() - 60_000);
  assert.ok(!("personalPreferences" in registered));

  // The device list shows only this account's devices, and a removed device
  // is not brought back by a routine confirmation, only by turning push on.
  const listed = asRecord(await callAction("listPushDevices", {}, user.auth));
  assert.equal(listed.limit, 10);
  assert.deepEqual((listed.devices as Array<Record<string, unknown>>).map((device) => [device.deviceId, device.platform]), [[deviceId, "integration"]]);
  assert.deepEqual(asRecord(await callAction("listPushDevices", {}, admin.auth)).devices, []);
  const refreshed = asRecord(await callAction("registerPushToken", {
    deviceId, permission: "granted", platform: "integration", refresh: true, token, userAgent: "Node integration test",
  }, user.auth));
  assert.equal(refreshed.deviceEnabled, true);
  await callAction("unregisterPushToken", { deviceId }, user.auth);
  const refreshedAfterRemoval = asRecord(await callAction("registerPushToken", {
    deviceId, permission: "granted", platform: "integration", refresh: true, token, userAgent: "Node integration test",
  }, user.auth));
  assert.equal(refreshedAfterRemoval.deviceEnabled, false);
  assert.deepEqual(asRecord(await callAction("listPushDevices", {}, user.auth)).devices, []);
  const reEnabled = asRecord(await callAction("registerPushToken", {
    deviceId, permission: "granted", platform: "integration", token, userAgent: "Node integration test",
  }, user.auth));
  assert.equal(reEnabled.deviceEnabled, true);

  await expectActionError(
    "permission-denied",
    () => callAction("getPlatformAdminNotificationPreferences", {}, user.auth),
  );
  const initialAdminPreferences = asRecord(await callAction(
    "getPlatformAdminNotificationPreferences",
    {},
    admin.auth,
  ));
  assert.deepEqual(initialAdminPreferences, {
    commentNotifications: false,
    facilityNotifications: false,
    issueNotifications: false,
  });
  const updated = asRecord(await callAction("updatePlatformAdminNotificationPreferences", {
    preferences: {
      commentNotifications: true,
      facilityNotifications: false,
      issueNotifications: true,
    },
  }, admin.auth));
  assert.deepEqual(updated, {
    commentNotifications: true,
    facilityNotifications: false,
    issueNotifications: true,
  });
  await expectActionError(
    "permission-denied",
    () => callAction("updatePlatformAdminNotificationPreferences", {
      preferences: updated,
    }, user.auth),
  );

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
  const { rows: reassignedTokens } = await database.sql`
    select device_id, uid from app_private.push_tokens where token = ${token}`;
  assert.deepEqual(reassignedTokens, [{ device_id: adminDeviceId, uid: admin.auth.uid }]);
  const adminPush = asRecord(await callAction("getPushNotificationPreference", {
    deviceId: adminDeviceId,
    permission: "granted",
  }, admin.auth));
  assert.equal(adminPush.deviceEnabled, true);

  await expectActionError(
    "permission-denied",
    () => callAction("getPlatformDashboard", {}, user.auth),
  );
  const dashboard = asRecord(await callAction("getPlatformDashboard", {}, admin.auth));
  assert.ok(["healthy", "attention", "critical"].includes(String(dashboard.status)));
  assert.equal(typeof dashboard.issuesByCategory, "object");
});
