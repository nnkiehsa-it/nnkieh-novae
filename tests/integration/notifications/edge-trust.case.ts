import { assert, integrationTest, requiredEnv } from "./support.ts";

integrationTest("real Worker HTTP boundaries reject missing origin, auth, and signatures", async () => {
  const workerUrl = requiredEnv("WORKER_URL").replace(/\/+$/u, "");
  const allowedOrigin = "http://localhost:3000";
  const post = async (path: string, body: unknown, headers: HeadersInit = {}) => {
    let response: Response | undefined;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      response = await fetch(`${workerUrl}${path}`, {
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

  const missingOrigin = await post("/v1/actions", { action: "getContentVersions", payload: {} });
  assert.equal(missingOrigin.status, 403);

  const unsupported = await post("/v1/actions", { action: "integrationUnknown", payload: {} }, {
    origin: allowedOrigin,
  });
  assert.equal(unsupported.status, 400);

  const unauthenticated = await post("/v1/actions", {
    action: "getContentVersions",
    payload: {},
  }, {
    origin: allowedOrigin,
  });
  assert.equal(unauthenticated.status, 401);

  const syncUser = await post("/v1/auth/sync", {}, {
    origin: allowedOrigin,
  });
  assert.equal(syncUser.status, 401);
  const realtimeTicket = await post("/v1/realtime/ticket", {}, {
    origin: allowedOrigin,
  });
  assert.equal(realtimeTicket.status, 401);
  const cloudinary = await post("/v1/webhooks/cloudinary", {}, { origin: allowedOrigin });
  assert.equal(cloudinary.status, 401);
  const healthcheck = await post("/v1/actions", { action: "healthcheck", payload: {} }, {
    origin: allowedOrigin,
    "x-healthcheck-secret": "wrong",
  });
  assert.equal(healthcheck.status, 403);

  const preflight = await fetch(`${workerUrl}/v1/actions`, {
    headers: { origin: allowedOrigin },
    method: "OPTIONS",
  });
  assert.equal(preflight.status, 204);
  const websocketWithoutUpgrade = await fetch(`${workerUrl}/v1/realtime`, {
    headers: { origin: allowedOrigin },
  });
  assert.equal(websocketWithoutUpgrade.status, 426);
});
