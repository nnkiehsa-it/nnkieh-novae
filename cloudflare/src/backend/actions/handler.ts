import type { AppDatabaseClient } from "../database/client.ts";
import { asRecord, asString, errorStatus } from "../shared/http.ts";
import { handleHealthcheck, requireAuth } from "./auth.ts";
import { getBackendActionDefinition } from "./action-registry.ts";
import { claimBackendHealthcheckRateLimit } from "./rate-limit.ts";
import { errorResponse, successResponse } from "./response.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import { executeBackendAction } from "./execution.ts";

export async function handleBackendAction(
  request: Request,
  body: Record<string, unknown>,
  requestId: string,
  database: AppDatabaseClient,
) {
  const log = createFunctionLogger("backendAction");
  const action = asString(body.action);
  try {
    const payload = asRecord(body.payload);
    if (!action) throw new Error("invalid-action");

    if (action === "healthcheck") {
      await claimBackendHealthcheckRateLimit();
      const data = await handleHealthcheck(request, database);
      log.success("backend-action.completed", { action, domain: "system", requestId, status: 200 });
      return successResponse(data, requestId);
    }

    const definition = getBackendActionDefinition(action);
    if (!definition) throw new Error("invalid-action");
    const auth = await requireAuth(database, request);
    const data = await executeBackendAction(definition, payload, auth, database);
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
    const fields = { action: action || "unknown", requestId, status };
    if (status >= 500) log.error("backend-action.failed", error, fields);
    else log.warn("backend-action.rejected", fields);
    return errorResponse(error, requestId);
  }
}
