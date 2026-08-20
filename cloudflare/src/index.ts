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

async function handleAction(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  requestId: string,
) {
  if (!isAllowedBrowserRequest(request, env)) return apiErrorResponse(request, env, requestId, "origin-denied");
  const bodyBytes = await readBody(request);
  const body = parseJsonRecord(bodyBytes);
  const action = typeof body.action === "string" ? body.action : "";
  if (!action) return apiErrorResponse(request, env, requestId, "invalid-action");
  if (action !== "healthcheck" && !(action in BACKEND_ACTION_POLICIES)) {
    return apiErrorResponse(request, env, requestId, "invalid-action");
  }
  if (action !== "healthcheck") {
    const uid = await requireBrowserUid(request, env, "rate-limit.operation");
    await claimActionRateLimit(env, uid, action);
  }

  const database = await createDatabaseClient(env);
  try {
    const response = await handleBackendAction(request, body, requestId, database);
    const policy = BACKEND_ACTION_POLICIES[action as keyof typeof BACKEND_ACTION_POLICIES];
    if (response.ok && policy?.group !== "read") ctx.waitUntil(env.JOBS.send({ type: "drain" }));
    return addCors(response, request, env);
  } finally {
    await database.close();
  }
}

async function handleSync(request: Request, env: Env, requestId: string) {
  if (!isAllowedBrowserRequest(request, env)) return apiErrorResponse(request, env, requestId, "origin-denied");
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

async function handleLoginCheck(request: Request, env: Env, requestId: string) {
  if (!isAllowedBrowserRequest(request, env)) return apiErrorResponse(request, env, requestId, "origin-denied");
  await claimLoginIngress(env, clientIp(request));
  await requireTurnstile(request, env, "auth_login");
  return jsonResponse(request, env, { ok: true });
}

async function handleSessionCheck(request: Request, env: Env, requestId: string) {
  if (!isAllowedBrowserRequest(request, env)) return apiErrorResponse(request, env, requestId, "origin-denied");
  await claimLoginIngress(env, clientIp(request));
  await requireTurnstile(request, env, "auth_restore");
  return jsonResponse(request, env, { ok: true });
}

async function handleRealtimeTicket(request: Request, env: Env, requestId: string) {
  if (!isAllowedBrowserRequest(request, env)) return apiErrorResponse(request, env, requestId, "origin-denied");
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
  requestId: string,
) {
  const body = await readBody(request);
  if (!await verifyCloudinarySignature(request, body, env.CLOUDINARY_API_SECRET)) {
    return apiErrorResponse(request, env, requestId, "invalid-signature");
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
  const requestId = crypto.randomUUID();
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
    return apiErrorResponse(request, env, requestId, "method-not-allowed", undefined, { allow: "POST, OPTIONS" });
  }

  try {
    if (pathname === "/v1/actions") return await handleAction(request, env, ctx, requestId);
    if (pathname === "/v1/auth/login-check") return await handleLoginCheck(request, env, requestId);
    if (pathname === "/v1/auth/session-check") return await handleSessionCheck(request, env, requestId);
    if (pathname === "/v1/auth/sync") return await handleSync(request, env, requestId);
    if (pathname === "/v1/realtime/ticket") return await handleRealtimeTicket(request, env, requestId);
    if (pathname === "/v1/webhooks/cloudinary") return await handleCloudinary(request, env, ctx, requestId);
    return apiErrorResponse(request, env, requestId, "not-found");
  } catch (error) {
    const message = error instanceof Error ? error.message : "internal-error";
    console.error({ message, requestId, path: pathname });
    if (error instanceof RateLimitError) {
      const code = isApiErrorCode(error.message) ? error.message : "internal-error";
      return apiErrorResponse(request, env, requestId, code, error.retryAfterSeconds);
    }
    const code = isApiErrorCode(message) ? message : "upstream-unavailable";
    return apiErrorResponse(request, env, requestId, code);
  }
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext) {
    return withRuntimeEnvironment(env, () => fetchHandler(request, env, ctx));
  },

  async queue(batch: MessageBatch<JobMessage>, env: Env) {
    await withRuntimeEnvironment(env, async () => {
      for (const message of batch.messages) {
        try {
          await processJobMessage(message.body, env);
          message.ack();
        } catch (error) {
          console.error({ event: "queue-message.failed", error, messageId: message.id });
          message.retry();
        }
      }
    });
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(env.JOBS.send({ type: "maintenance" }));
  },
} satisfies ExportedHandler<Env, JobMessage>;
