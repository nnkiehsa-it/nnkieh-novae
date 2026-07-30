import { assert, authenticatedJwt, callAction, createClient, DATA_RETENTION, expectActionError, failNextFcmRequests, integrationTest, notificationStressScale, readFcmRequests, requestId, requiredEnv, resetFcmRequests, saveCategoryDraft, seedActor, supabase } from "./support.ts";
import type { Database } from "./support.ts";

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
