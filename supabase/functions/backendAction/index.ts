import { createDatabaseClient } from "../_shared/database-client.ts";
import {
  asRecord,
  asString,
  errorStatus,
  handleCorsPreflight,
  readJsonRecord,
} from "../_shared/http.ts";
import { handleHealthcheck, requireAuth } from "./auth.ts";
import { getBackendActionDefinition } from "./action-registry.ts";
import { claimBackendHealthcheckRateLimit } from "./rate-limit.ts";
import { errorResponse, successResponse } from "./response.ts";
import { requireOriginSecret } from "../_shared/origin.ts";
import { createFunctionLogger } from "../_shared/observability.ts";
import { executeBackendAction } from "./execution.ts";

Deno.serve(async (request) => {
  const originFailure = requireOriginSecret(request);
  if (originFailure) return originFailure;
  const preflight = handleCorsPreflight(request);
  if (preflight) return preflight;

  const requestId = crypto.randomUUID();
  const log = createFunctionLogger("backendAction");
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
    if (!action) throw new Error("invalid-action");

    const supabase = createDatabaseClient();
    if (action === "healthcheck") {
      await claimBackendHealthcheckRateLimit();
      const data = await handleHealthcheck(request, supabase);
      log.success("backend-action.completed", { action, domain: "system", requestId, status: 200 });
      return successResponse(data, requestId);
    }

    const definition = getBackendActionDefinition(action);
    if (!definition) throw new Error("invalid-action");
    const auth = await requireAuth(supabase, request);
    const data = await executeBackendAction(definition, payload, auth, supabase);
    if (definition.rateLimitGroup !== "read") {
      log.success("backend-action.completed", {
        action,
        domain: definition.domain,
        requestId,
        status: 200,
      });
    }
    return successResponse(data, requestId);
  } catch (error) {
    const status = errorStatus(error);
    const fields = {
      action: action || "unknown",
      requestId,
      status,
    };
    if (status >= 500) log.error("backend-action.failed", error, fields);
    else log.warn("backend-action.rejected", fields);
    return errorResponse(error, requestId);
  }
});
