import { requireFirebaseUid } from "./auth";
import { requireFirebaseAppCheck } from "./app-check";
import {
  apiErrorResponse,
  corsHeaders,
  isAllowedBrowserRequest,
  jsonResponse,
  parseJsonRecord,
  readBody,
} from "./http";
import {
  claimActionRateLimit,
  claimCloudinaryIngress,
  claimInvalidAuthenticationIngress,
  claimLoginIngress,
  claimRealtimeTicketRateLimit,
  claimSyncUser,
  RateLimitError,
} from "./rate-limit";
import { verifyCloudinarySignature } from "./signature";
import { handleMedia } from "./media";
import type { Env } from "./types";
import { isApiErrorCode } from "../generated/api-errors";
import { BACKEND_ACTION_POLICIES } from "../generated/backend-actions";
import { createDatabaseClient } from "./backend/database/client";
import { handleBackendAction } from "./backend/actions/handler";
import { handleSyncUser } from "./backend/sync-user";
import { handleCloudinaryWebhook } from "./backend/cloudinary-webhook";
import { createRealtimeTicket } from "./backend/realtime-ticket";
import { withRuntimeEnvironment } from "./backend/shared/env";
import { processJobMessage, type JobMessage } from "./backend/jobs/consumer";
import { BusinessRateLimiter } from "./durable/business-rate-limiter";
import { RealtimeHub } from "./durable/realtime-hub";
import { requireTurnstile } from "./turnstile";
import { createFunctionLogger } from "./backend/shared/observability";

export { BusinessRateLimiter, RealtimeHub };

function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip")?.trim() || "unknown";
}

async function requireBrowserUid(
  request: Request,
  env: Env,
  rateLimitCode: "rate-limit.login-sync" | "rate-limit.operation" | "rate-limit.read",
) {
  try {
    await requireFirebaseAppCheck(request, env);
    return await requireFirebaseUid(request, env);
  } catch (error) {
    await claimInvalidAuthenticationIngress(env, clientIp(request), rateLimitCode);
    throw error;
  }
}

function addCors(response: Response, request: Request, env: Env) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(corsHeaders(request, env))) headers.set(name, value);
  headers.set("cache-control", "no-store");
  return new Response(response.body, {
    headers,
    status: response.status,
    statusText: response.statusText,
  });
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function resolveOperationId(request: Request, requiresOperationId: boolean): { operationId: string; valid: boolean } {
  const header = request.headers.get("x-novae-operation-id")?.trim();
  if (header) {
    return { operationId: header, valid: UUID_PATTERN.test(header) };
  }
  if (requiresOperationId) {
    return { operationId: crypto.randomUUID(), valid: false };
  }
  return { operationId: crypto.randomUUID(), valid: true };
}

async function handleAction(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  invocationId: string,
) {
  if (!isAllowedBrowserRequest(request, env)) {
    return apiErrorResponse(request, env, crypto.randomUUID(), "origin-denied");
  }
  const bodyBytes = await readBody(request);
  const body = parseJsonRecord(bodyBytes);
  const action = typeof body.action === "string" ? body.action : "";
  if (!action) return apiErrorResponse(request, env, crypto.randomUUID(), "invalid-action");
  if (action !== "healthcheck" && !(action in BACKEND_ACTION_POLICIES)) {
    return apiErrorResponse(request, env, crypto.randomUUID(), "invalid-action");
  }

  const policy = BACKEND_ACTION_POLICIES[action as keyof typeof BACKEND_ACTION_POLICIES];
  const isWriteAction = action !== "healthcheck" && policy?.group !== "read";
  const { operationId, valid } = resolveOperationId(request, isWriteAction);

  if (!valid) {
    return apiErrorResponse(request, env, operationId, isWriteAction && !request.headers.get("x-novae-operation-id") ? "validation-required" : "validation-invalid");
  }

  if (action !== "healthcheck") {
    const uid = await requireBrowserUid(request, env, "rate-limit.operation");
    await claimActionRateLimit(env, uid, action);
  }

  const database = await createDatabaseClient(env);
  try {
    const response = await handleBackendAction(request, body, operationId, database, invocationId);
    if (response.ok && policy?.group !== "read") ctx.waitUntil(env.JOBS.send({ type: "drain" }));
    return addCors(response, request, env);
  } finally {
    await database.close();
  }
}

async function handleSync(request: Request, env: Env, operationId: string) {
  if (!isAllowedBrowserRequest(request, env)) return apiErrorResponse(request, env, operationId, "origin-denied");
  const body = await readBody(request);
  parseJsonRecord(body);
  const uid = await requireBrowserUid(request, env, "rate-limit.login-sync");
  await claimSyncUser(env, uid);
  const database = await createDatabaseClient(env);
  try {
    return addCors(await handleSyncUser(request, database), request, env);
  } finally {
    await database.close();
  }
}

async function handleLoginCheck(request: Request, env: Env, operationId: string) {
  if (!isAllowedBrowserRequest(request, env)) return apiErrorResponse(request, env, operationId, "origin-denied");
  await claimLoginIngress(env, clientIp(request));
  await requireTurnstile(request, env, "auth_login");
  return jsonResponse(request, env, { ok: true });
}

async function handleSessionCheck(request: Request, env: Env, operationId: string) {
  if (!isAllowedBrowserRequest(request, env)) return apiErrorResponse(request, env, operationId, "origin-denied");
  await claimLoginIngress(env, clientIp(request));
  await requireTurnstile(request, env, "auth_restore");
  return jsonResponse(request, env, { ok: true });
}

async function handleRealtimeTicket(request: Request, env: Env, operationId: string) {
  if (!isAllowedBrowserRequest(request, env)) return apiErrorResponse(request, env, operationId, "origin-denied");
  const uid = await requireBrowserUid(request, env, "rate-limit.read");
  await claimRealtimeTicketRateLimit(env, uid);
  const database = await createDatabaseClient(env);
  try {
    return jsonResponse(request, env, { data: await createRealtimeTicket(request, database), success: true });
  } finally {
    await database.close();
  }
}

async function handleCloudinary(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  operationId: string,
) {
  const body = await readBody(request);
  if (!await verifyCloudinarySignature(request, body, env.CLOUDINARY_API_SECRET)) {
    return apiErrorResponse(request, env, operationId, "invalid-signature");
  }
  await claimCloudinaryIngress(env, clientIp(request));
  const database = await createDatabaseClient(env);
  try {
    const response = await handleCloudinaryWebhook(body, database);
    if (response.ok) ctx.waitUntil(env.JOBS.send({ type: "drain" }));
    return response;
  } finally {
    await database.close();
  }
}

async function fetchHandler(request: Request, env: Env, ctx: ExecutionContext) {
  const invocationId = crypto.randomUUID();
  const headerOpId = request.headers.get("x-novae-operation-id")?.trim();
  const operationId = headerOpId && UUID_PATTERN.test(headerOpId) ? headerOpId : crypto.randomUUID();
  const pathname = new URL(request.url).pathname;
  const mediaMatch = pathname.match(/^\/v1\/media\/([^/]+)\/([^/]+)$/u);
  if (mediaMatch && (request.method === "GET" || request.method === "HEAD")) {
    return await handleMedia(request, env, mediaMatch[1], mediaMatch[2]);
  }
  if (pathname === "/v1/realtime" && request.method === "GET") {
    if (!isAllowedBrowserRequest(request, env)) return new Response(null, { status: 403 });
    return await env.REALTIME.getByName("global").fetch(request);
  }
  if (request.method === "OPTIONS") {
    if (!isAllowedBrowserRequest(request, env)) return new Response(null, { status: 403 });
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }
  if (request.method !== "POST") {
    return apiErrorResponse(request, env, operationId, "method-not-allowed", {}, { allow: "POST, OPTIONS" });
  }

  try {
    if (pathname === "/v1/actions") return await handleAction(request, env, ctx, invocationId);
    if (pathname === "/v1/auth/login-check") return await handleLoginCheck(request, env, operationId);
    if (pathname === "/v1/auth/session-check") return await handleSessionCheck(request, env, operationId);
    if (pathname === "/v1/auth/sync") return await handleSync(request, env, operationId);
    if (pathname === "/v1/realtime/ticket") return await handleRealtimeTicket(request, env, operationId);
    if (pathname === "/v1/webhooks/cloudinary") return await handleCloudinary(request, env, ctx, operationId);
    return apiErrorResponse(request, env, operationId, "not-found");
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal-error";
    const failureId = crypto.randomUUID();
    createFunctionLogger("fetchHandler", { invocationId, operationId }).error("request.failed", error, {
      failureId,
      path: pathname,
    });
    if (error instanceof RateLimitError) {
      const code = isApiErrorCode(error.message) ? error.message : "internal-error";
      return apiErrorResponse(request, env, operationId, code, { retryAfterSeconds: error.retryAfterSeconds });
    }
    const code = isApiErrorCode(message) ? message : "upstream-unavailable";
    return apiErrorResponse(request, env, operationId, code, { failureId });
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return withRuntimeEnvironment(env, () => fetchHandler(request, env, ctx));
  },

  async queue(batch: MessageBatch<JobMessage>, env: Env) {
    await withRuntimeEnvironment(env, async () => {
      const log = createFunctionLogger("queueConsumer");
      for (const message of batch.messages) {
        try {
          await processJobMessage(message.body, env);
          message.ack();
        } catch (error) {
          log.error("queue-message.failed", error, { messageId: message.id });
          message.retry();
        }
      }
    });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(env.JOBS.send({ type: "maintenance" }));
  },
} satisfies ExportedHandler<Env, JobMessage>;
