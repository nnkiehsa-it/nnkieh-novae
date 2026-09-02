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
  operationId: string,
  database: AppDatabaseClient,
  invocationId?: string,
) {
  const log = createFunctionLogger("backendAction", { invocationId, operationId });
  const action = asString(body.action);
  try {
    const payload = asRecord(body.payload);
    if (!action) throw new Error("invalid-action");

    if (action === "healthcheck") {
      await claimBackendHealthcheckRateLimit();
      const data = await handleHealthcheck(request, database);
      log.success("backend-action.completed", { action, domain: "system", operationId, status: 200 });
      return successResponse(data, operationId);
    }

    const definition = getBackendActionDefinition(action);
    if (!definition) throw new Error("invalid-action");
    const auth = await requireAuth(database, request);
    const data = await executeBackendAction(definition, payload, auth, database, operationId);
    if (definition.rateLimitGroup !== "read" && definition.rateLimitGroup !== "upload-resolve") {
      log.success("backend-action.completed", {
        action,
        domain: definition.domain,
        operationId,
        status: 200,
      });
    }
    return successResponse(data, operationId);
  } catch (error) {
    const status = errorStatus(error);
    const failureId = status >= 500 ? crypto.randomUUID() : undefined;
    const fields = { action: action || "unknown", operationId, status, ...(failureId ? { failureId } : {}) };
    if (status >= 500) log.error("backend-action.failed", error, fields);
    else log.warn("backend-action.rejected", fields);
    return errorResponse(error, operationId, failureId);
  }
}
