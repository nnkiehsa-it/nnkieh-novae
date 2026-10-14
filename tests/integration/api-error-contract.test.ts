import assert from "node:assert/strict";
import { errorEnvelope, errorResponse, streamingResponse } from "../../cloudflare/src/backend/actions/response.ts";
import { readOperationPolicies } from "../../cloudflare/src/backend/shared/operation-policies.ts";
import { claimFixedWindowRateLimit, utcHourWindow } from "../../cloudflare/src/backend/shared/business-rate-limit.ts";
import { RateLimitError } from "../../cloudflare/src/rate-limit.ts";
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
  const [start, stored] = await underPolicies(async () => {
    const empty = (async function* () {})();
    const { response } = streamingResponse({ data: { ok: true } }, empty, "request-policy-revision", async () => {
      throw new Error("unexpected-failure");
    });
    const [firstLine] = (await response.text()).split("\n");
    return [JSON.parse(firstLine) as { policyRevision: number; type: string }, await readOperationPolicies(database)] as const;
  });
  assert.equal(start.type, "start");
  assert.equal(start.policyRevision, stored.revision);
});
