import assert from "node:assert/strict";
import { errorEnvelope, errorResponse, successEnvelope } from "../../cloudflare/src/backend/actions/response.ts";
import { readOperationPolicies } from "../../cloudflare/src/backend/shared/operation-policies.ts";
import { claimFixedWindowRateLimit, RateLimitError, utcHourWindow } from "../../cloudflare/src/backend/shared/business-rate-limit.ts";
import { database, integrationTest, underPolicies } from "./helpers.ts";

integrationTest("API errors expose stable codes without backend-localized messages", async () => {
  const envelope = errorEnvelope(new Error("title-required"), "request-123");
  assert.deepEqual(envelope, {
    error: { code: "validation-required" },
    operationId: "request-123",
    success: false,
  });
  assert.equal("message" in envelope.error, false);

  const response = errorResponse(new Error("permission-denied"), "request-456");
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    error: { code: "permission-denied" },
    operationId: "request-456",
    success: false,
  });
});

integrationTest("rate-limit errors include machine-readable retry metadata", async () => {
  const response = errorResponse(
    new RateLimitError("rate-limit.issue-create", 42),
    "request-rate-limit",
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "42");
  assert.deepEqual(await response.json(), {
    error: { code: "rate-limit.issue-create", retryAfterSeconds: 42 },
    operationId: "request-rate-limit",
    success: false,
  });
});

integrationTest("Durable Object business limits allow the configured quota and reject overflow", async () => {
  const identifier = `integration-rate-${crypto.randomUUID()}`;
  const config = { errorCode: "rate-limit.issue-create" as const, limit: 1 };
  await claimFixedWindowRateLimit(identifier, "integration.issue-create", utcHourWindow(), config);
  await assert.rejects(
    () => claimFixedWindowRateLimit(identifier, "integration.issue-create", utcHourWindow(), config),
    (error: unknown) => error instanceof RateLimitError && error.message === "rate-limit.issue-create",
  );
});

integrationTest("A successful answer names the settings revision it was produced under", async () => {
  const [envelope, stored] = await underPolicies(async () => [
    successEnvelope({ ok: true }, "request-policy-revision"),
    await readOperationPolicies(database),
  ] as const);
  assert.equal(envelope.policyRevision, stored.revision);
  assert.equal(envelope.success, true);
});
