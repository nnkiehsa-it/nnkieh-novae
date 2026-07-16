import assert from "node:assert/strict";
import { createClient } from "npm:@supabase/supabase-js@2";
import { DATA_RETENTION } from "../../supabase/functions/_shared/data-retention.ts";
import type { Database } from "../../supabase/functions/_shared/database.ts";
import { ISSUE_CATEGORY_IDS } from "../../supabase/functions/_shared/issue-categories.ts";
import {
  asRecord,
  callAction,
  expectActionError,
  integrationTest,
  requestId,
  seedActor,
  supabase,
} from "./helpers.ts";

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is required for local integration tests.`);
  return value;
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

integrationTest("worker database lifecycles and maintenance RPC", async () => {
  const expiredOwner = await seedActor("expired-support-owner");
  const expiredIssueResult = asRecord(await callAction("createIssue", {
    category: ISSUE_CATEGORY_IDS[0],
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
  const { data: outboxEvents, error: outboxClaimError } = await supabase
    .schema("app_api")
    .rpc("claim_outbox_events", { batch_size: 100 });
  if (outboxClaimError) throw outboxClaimError;
  const outboxEvent = ((outboxEvents ?? []) as Array<{ id: string; target_id: string }>)
    .find((event) => event.target_id === outboxTarget);
  assert.ok(outboxEvent);
  const { error: outboxFailError } = await supabase.schema("app_api")
    .rpc("fail_outbox_event", {
      error_message: "integration expected failure",
      event_id: outboxEvent.id,
    });
  if (outboxFailError) throw outboxFailError;

  const { data: maintenance, error: maintenanceError } = await supabase
    .schema("app_api")
    .rpc("run_maintenance_cleanup", {
      retention_config: DATA_RETENTION,
      valid_issue_categories: [...ISSUE_CATEGORY_IDS],
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
