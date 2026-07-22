import assert from "node:assert/strict";
import { createClient } from "npm:@supabase/supabase-js@2";
import { DATA_RETENTION } from "../../supabase/functions/_shared/data-retention.ts";
import type { Database } from "../../supabase/functions/_shared/database.ts";
import {
  asRecord,
  callAction,
  expectActionError,
  integrationTest,
  requestId,
  seedActor,
  supabase,
} from "./helpers.ts";

const notificationStressScale = Math.min(
  20,
  Math.max(4, Number(Deno.env.get("NOVAE_STRESS_SCALE") ?? 4)),
);

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is required for local integration tests.`);
  return value;
}

interface FcmRequest {
  body: {
    message?: {
      data?: Record<string, string>;
      token?: string;
      topic?: string;
    };
  };
  path: string;
}

function fcmReceiverUrl() {
  return requiredEnv("FCM_EMULATOR_URL").replace("host.docker.internal", "127.0.0.1");
}

async function resetFcmRequests() {
  const response = await fetch(`${fcmReceiverUrl()}/__requests`, { method: "DELETE" });
  assert.equal(response.status, 200);
}

async function readFcmRequests() {
  const response = await fetch(`${fcmReceiverUrl()}/__requests`);
  assert.equal(response.status, 200);
  const result = await response.json() as { requests: FcmRequest[] };
  return result.requests;
}

function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
}

async function authenticatedJwt(uid: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    aud: Deno.env.get("FIREBASE_PROJECT_ID") ?? "local-test",
    exp: now + 3600,
    iat: now,
    role: "authenticated",
    sub: uid,
  }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requiredEnv("SUPABASE_JWT_SECRET")),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

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
  assert.ok(Number(snapshot.openedAtMs) > 0);

  const state = asRecord(await callAction("getNotificationReadState", {}, user.auth));
  assert.equal(asRecord(state.state).uid, user.auth.uid);
  const unread = asRecord(await callAction("getNotificationUnreadHint", {}, user.auth));
  assert.equal(typeof unread.hasUnread, "boolean");
  const opened = asRecord(await callAction("markNotificationsOpened", {}, user.auth));
  assert.equal(opened.success, true);

  const deviceId = `integration-device-${crypto.randomUUID()}`;
  const initialPreference = asRecord(await callAction("getPushNotificationPreference", {
    deviceId,
    permission: "default",
  }, user.auth));
  assert.equal(initialPreference.deviceEnabled, false);
  const registered = asRecord(await callAction("registerPushToken", {
    deviceId,
    permission: "granted",
    platform: "integration",
    token: `integration-token-${crypto.randomUUID()}`,
    userAgent: "Deno integration test",
  }, user.auth));
  assert.equal(registered.deviceEnabled, true);
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

  await expectActionError(
    "permission-denied",
    () => callAction("getPlatformDashboard", {}, user.auth),
  );
  const dashboard = asRecord(await callAction("getPlatformDashboard", {}, admin.auth));
  assert.ok("stats" in dashboard);
  assert.ok("operations" in dashboard);
});

integrationTest("new proposal and facility notifications are personal to category managers", async () => {
  const admin = await seedActor(`category-notification-admin-${crypto.randomUUID()}`, { roles: ["platform-admin"] });
  const issueCategoryId = `notify-issue-${crypto.randomUUID().slice(0, 8)}`;
  const facilityCategoryId = `notify-facility-${crypto.randomUUID().slice(0, 8)}`;
  await callAction("saveIssueCategory", {
    category: {
      authorVisible: true,
      commentsEnabled: true,
      id: issueCategoryId,
      isActive: true,
      isDefault: false,
      label: "通知測試提案",
      readAccess: "school",
      responseDeadlineDays: null,
      sortOrder: 20_000,
      supportDeadlineDays: null,
      supportEnabled: false,
      supportGoal: null,
    },
    requestId: requestId("notification-issue-category"),
  }, admin.auth);
  await callAction("saveFacilityCategory", {
    category: {
      id: facilityCategoryId,
      isActive: true,
      isDefault: false,
      label: "通知測試設備",
      sortOrder: 20_000,
    },
    requestId: requestId("notification-facility-category"),
  }, admin.auth);

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
  const { error: disableFacilityNotificationError } = await supabase.schema("app_private")
    .from("user_facility_category_assignments")
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
  const { data: preservedOptOut, error: preservedOptOutError } = await supabase.schema("app_private")
    .from("user_facility_category_assignments")
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

  const workerUrl = `${requiredEnv("SUPABASE_FUNCTIONS_URL").replace(/\/+$/u, "")}/outboxWorker`;
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const { data, error } = await supabase.schema("app_private").from("notifications")
      .select("recipient_uid,source,target_id,type").in("target_id", [issueId, facilityId]);
    if (error) throw error;
    if ((data ?? []).length >= managers.length * 2) break;
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

  const { data: notifications, error: notificationError } = await supabase.schema("app_private")
    .from("notifications")
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

integrationTest("worker database lifecycles and maintenance RPC", async () => {
  const { data: categoryRows, error: categoryError } = await supabase.schema("app_private")
    .from("issue_categories").select("id").eq("is_active", true).order("sort_order");
  if (categoryError) throw categoryError;
  const issueCategoryIds = (categoryRows ?? []).map((row) => String(row.id));
  assert.ok(issueCategoryIds.length > 0);
  const expiredOwner = await seedActor("expired-support-owner");
  const expiredIssueResult = asRecord(await callAction("createIssue", {
    category: issueCategoryIds[0],
    content: "Integration expired support content",
    requestId: requestId("expired-support"),
    title: "Expired support",
  }, expiredOwner.auth));
  const expiredIssue = asRecord(expiredIssueResult.issue);
  const { error: expireSetupError } = await supabase.schema("app_private")
    .from("issues")
    .update({
      support_deadline_at: new Date(Date.now() - 60_000).toISOString(),
      support_enabled: true,
      support_goal: 50,
      support_met_at: null,
      status: "pending",
    })
    .eq("id", String(expiredIssue.id));
  if (expireSetupError) throw expireSetupError;
  const { data: expiredCount, error: expireError } = await supabase
    .schema("app_private")
    .rpc("reject_expired_support_issues");
  if (expireError) throw expireError;
  assert.equal(expiredCount, 1);
  const { data: rejectedIssue, error: rejectedIssueError } = await supabase
    .schema("app_private")
    .from("issues")
    .select("status")
    .eq("id", String(expiredIssue.id))
    .single();
  if (rejectedIssueError) throw rejectedIssueError;
  assert.equal(rejectedIssue.status, "auto-rejected");

  const deletionTarget = `integration-deletion-${crypto.randomUUID()}`;
  const { error: deletionInsertError } = await supabase.schema("app_private")
    .from("deletion_jobs")
    .insert({
      target_id: deletionTarget,
      target_type: "integration-test",
    });
  if (deletionInsertError) throw deletionInsertError;
  const { data: deletionJobs, error: deletionClaimError } = await supabase
    .schema("app_api")
    .rpc("claim_deletion_jobs", { batch_size: 50 });
  if (deletionClaimError) throw deletionClaimError;
  const deletionJob = ((deletionJobs ?? []) as Array<{ id: string; target_id: string }>)
    .find((job) => job.target_id === deletionTarget);
  assert.ok(deletionJob);
  const { error: deletionCompleteError } = await supabase.schema("app_api")
    .rpc("complete_deletion_job", { job_id: deletionJob.id });
  if (deletionCompleteError) throw deletionCompleteError;

  const outboxTarget = `integration-outbox-${crypto.randomUUID()}`;
  const { error: outboxInsertError } = await supabase.schema("app_private")
    .from("outbox_events")
    .insert({
      actor_uid: "integration-worker",
      event_type: "integration.test",
      payload: { source: "local-verifier" },
      target_id: outboxTarget,
      target_type: "integration-test",
    });
  if (outboxInsertError) throw outboxInsertError;
  let outboxEvent: { id: string; target_id: string } | undefined;
  for (let batch = 0; batch < 10 && !outboxEvent; batch += 1) {
    const { data: outboxEvents, error: outboxClaimError } = await supabase
      .schema("app_api")
      .rpc("claim_outbox_events", { batch_size: 100 });
    if (outboxClaimError) throw outboxClaimError;
    outboxEvent = ((outboxEvents ?? []) as Array<{ id: string; target_id: string }>)
      .find((event) => event.target_id === outboxTarget);
  }
  assert.ok(outboxEvent);
  const errorTraceId = crypto.randomUUID();
  const { error: outboxFailError } = await supabase.schema("app_api")
    .rpc("fail_outbox_event", {
      error_trace_id: errorTraceId,
      event_id: outboxEvent.id,
    });
  if (outboxFailError) throw outboxFailError;
  const { data: failedOutbox, error: failedOutboxError } = await supabase.schema("app_private")
    .from("outbox_events")
    .select("error_trace_id")
    .eq("id", outboxEvent.id)
    .single();
  if (failedOutboxError) throw failedOutboxError;
  assert.equal(failedOutbox.error_trace_id, errorTraceId);
  const { error: legacyFailError } = await supabase.schema("app_api")
    .rpc("fail_outbox_event", {
      error_message: "legacy-format-must-not-exist",
      event_id: outboxEvent.id,
    } as never);
  assert.ok(legacyFailError, "legacy error_message RPC parameter must be removed");

  const { data: maintenance, error: maintenanceError } = await supabase
    .schema("app_api")
    .rpc("run_maintenance_cleanup", {
      retention_config: DATA_RETENTION,
      valid_issue_categories: issueCategoryIds,
    });
  if (maintenanceError) throw maintenanceError;
  assert.ok(maintenance && typeof maintenance === "object");
});

integrationTest("raw PostgREST access fails closed while service role remains available", async () => {
  const url = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const anon = createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
  });
  const anonResult = await anon.schema("app_private").from("user_profiles").select("uid").limit(1);
  assert.ok(anonResult.error, "anon must not read app_private.user_profiles");

  const uid = `local-test-rls-${crypto.randomUUID()}`;
  const authenticated = createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${await authenticatedJwt(uid)}`,
      },
    },
  });
  const authenticatedResult = await authenticated.schema("app_private")
    .from("user_profiles")
    .select("uid")
    .limit(1);
  assert.ok(authenticatedResult.error, "authenticated must not read private profiles directly");

  const serviceResult = await supabase.schema("app_private")
    .from("user_profiles")
    .select("uid")
    .limit(1);
  assert.equal(serviceResult.error, null);
});

integrationTest("real Edge Function HTTP boundaries reject missing trust signals", async () => {
  const functionsUrl = requiredEnv("SUPABASE_FUNCTIONS_URL").replace(/\/+$/u, "");
  const originSecret = requiredEnv("EDGE_ORIGIN_SECRET");
  const post = async (functionName: string, body: unknown, headers: HeadersInit = {}) => {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      response = await fetch(`${functionsUrl}/${functionName}`, {
        body: JSON.stringify(body),
        headers: { "content-type": "application/json", ...headers },
        method: "POST",
      });
      if (response.status !== 502 && response.status !== 503) return response;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    assert.ok(response);
    return response;
  };

  const missingOrigin = await post("backendAction", { action: "getContentRevisions", payload: {} });
  assert.equal(missingOrigin.status, 401);

  const unsupported = await post("backendAction", { action: "integrationUnknown", payload: {} }, {
    "x-novae-origin-secret": originSecret,
  });
  assert.equal(unsupported.status, 400);

  const unauthenticated = await post("backendAction", {
    action: "getContentRevisions",
    payload: {},
  }, {
    "x-novae-origin-secret": originSecret,
  });
  assert.equal(unauthenticated.status, 401);

  for (const functionName of [
    "maintenanceCleanup",
    "outboxWorker",
    "processDeletionJobs",
  ]) {
    const response = await post(functionName, {}, {
      "x-novae-origin-secret": originSecret,
    });
    assert.equal(response.status, 401, `${functionName} must require its bearer secret`);
  }

  const syncUser = await post("syncUser", {}, {
    "x-novae-origin-secret": originSecret,
  });
  assert.equal(syncUser.status, 401);
  const cloudinary = await post("cloudinaryWebhook", {}, {
    "x-novae-origin-secret": originSecret,
  });
  assert.equal(cloudinary.status, 401);
});
