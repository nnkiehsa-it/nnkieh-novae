import { createClient } from "npm:@supabase/supabase-js@2";
import type { Database } from "../_shared/database.ts";
import { requireEnv } from "../_shared/env.ts";
import {
  asRecord,
  asString,
  errorMessage,
  errorStatus,
  handleCorsPreflight,
  readJsonRecord,
} from "../_shared/http.ts";
import { handleHealthcheck, requireAuth } from "./auth.ts";
import { getBackendActionDefinition, type BackendActionDefinition } from "./action-registry.ts";
import { claimBackendActionRateLimit, claimBackendHealthcheckRateLimit } from "./rate-limit.ts";
import { errorResponse, successResponse } from "./response.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";

async function runWithIdempotency(
  definition: BackendActionDefinition,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
  execute: () => Promise<JsonRecord>,
) {
  const action = definition.name;
  const requestId = asString(payload.requestId);
  if (definition.requiresRequestId && !requestId) {
    throw new Error("request-id-required");
  }
  if (!requestId || !definition.idempotent) {
    return await execute();
  }

  const { data: claimData, error: claimError } = await supabase
    .schema("app_api")
    .rpc("claim_idempotency_key", {
      action_name: action,
      actor_uid: auth.uid,
      request_id: requestId,
    })
    .single();
  if (claimError) throw claimError;

  const claim = asRecord(claimData);
  if (claim.completed === true) return asRecord(claim.response);
  if (claim.claimed !== true) throw new Error("request-in-progress");

  let response: JsonRecord;
  try {
    response = await execute();
  } catch (error) {
    await supabase
      .schema("app_api")
      .rpc("release_idempotency_key", {
        action_name: action,
        actor_uid: auth.uid,
        request_id: requestId,
      });
    throw error;
  }

  const { error: completeError } = await supabase
    .schema("app_api")
    .rpc("complete_idempotency_key", {
      action_name: action,
      action_response: response,
      actor_uid: auth.uid,
      request_id: requestId,
    });
  if (completeError) throw completeError;
  return response;
}

Deno.serve(async (request) => {
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const requestId = crypto.randomUUID();
  let action = "";

  try {
    if (request.method !== "POST") {
      return errorResponse(new Error("method-not-allowed"), requestId, {
        headers: { Allow: "POST" },
      });
    }

    const body = await readJsonRecord(request);
    action = asString(body.action);
    const payload = asRecord(body.payload);
    if (!action) throw new Error("missing action");

    const supabase = createClient<Database>(
      requireEnv("SUPABASE_URL"),
      requireEnv("APP_SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    if (action === "healthcheck") {
      await claimBackendHealthcheckRateLimit();
      return successResponse(await handleHealthcheck(request, supabase), requestId);
    }

    const definition = getBackendActionDefinition(action);
    if (!definition) throw new Error(`Unsupported action: ${action}`);
    const auth = await requireAuth(supabase, request);
    await claimBackendActionRateLimit(auth.uid, definition);
    if (definition.requiresAdmin && !auth.isAdmin) throw new Error("permission-denied");
    const data = await runWithIdempotency(
      definition,
      payload,
      auth,
      supabase,
      () => definition.handler(action, payload, auth, supabase),
    );
    return successResponse(data, requestId);
  } catch (error) {
    const status = errorStatus(error);
    console.error(JSON.stringify({
      action: action || "unknown",
      error: errorMessage(error),
      requestId,
      stack: error instanceof Error ? error.stack : undefined,
      status,
    }));
    return errorResponse(error, requestId);
  }
});
