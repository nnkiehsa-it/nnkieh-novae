import assert from "node:assert/strict";
import test from "node:test";
import { read } from "./helpers.mjs";

const workerModules = [
  ["cloudflare/src/backend/actions/handler.ts", "backendAction"],
  ["cloudflare/src/backend/sync-user.ts", "syncUser"],
  ["cloudflare/src/backend/cloudinary-webhook.ts", "cloudinaryWebhook"],
  ["cloudflare/src/backend/jobs/outbox.ts", "outboxWorker"],
  ["cloudflare/src/backend/jobs/deletion.ts", "processDeletionJobs"],
  ["cloudflare/src/backend/jobs/realtime.ts", "realtimeWorker"],
  ["cloudflare/src/backend/jobs/maintenance.ts", "maintenanceCleanup"],
];

test("Worker modules use shared, privacy-safe structured log records", async () => {
  const observability = await read("cloudflare/src/backend/shared/observability.ts");
  assert.match(observability, /createFunctionLogger/u);
  assert.match(observability, /invocationId/u);
  assert.match(observability, /durationMs/u);
  assert.match(observability, /publicErrorCode/u);
  assert.match(observability, /never pass request payloads, credentials, email addresses, or user profile data/u);

  for (const [path, functionName] of workerModules) {
    const source = await read(path);
    assert.match(source, new RegExp(`createFunctionLogger\\("${functionName}"\\)`, "u"));
  }
});
