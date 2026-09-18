import type { AppDatabaseClient } from "../database/client.ts";
import { asRecord, asString, errorStatus, publicErrorBody } from "../shared/http.ts";
import { handleHealthcheck } from "./auth.ts";
import { resolveAuthContext } from "./auth.ts";
import { getBackendActionDefinition } from "./action-registry.ts";
import { claimBackendHealthcheckRateLimit } from "./rate-limit.ts";
import { errorResponse, streamingResponse } from "./response.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import { executeBackendActionSegments } from "./execution.ts";
import { recordOperationalError } from "../shared/operational-telemetry.ts";
import type { ActionSegment } from "./types.ts";
import type { FirebaseAuthContext } from "../shared/firebase-auth.ts";

/** What one action answers, always as a stream of pieces. */
export interface BackendActionResponse {
  /** Settles when the last piece has been written and the database is free. */
  done: Promise<void>;
  response: Response;
}

async function* healthcheckSegments(request: Request, database: AppDatabaseClient): AsyncGenerator<ActionSegment> {
  const data = await handleHealthcheck(request, database);
  await claimBackendHealthcheckRateLimit();
  yield { data };
}

export async function handleBackendAction(
  request: Request,
  body: Record<string, unknown>,
  operationId: string,
  database: AppDatabaseClient,
  firebaseUser: FirebaseAuthContext | null,
  invocationId?: string,
): Promise<BackendActionResponse> {
  const log = createFunctionLogger("backendAction", { invocationId, operationId });
  const action = asString(body.action);

  const recordFailure = async (error: unknown) => {
    const status = errorStatus(error);
    const failureId = status >= 500 ? crypto.randomUUID() : undefined;
    const fields = { action: action || "unknown", operationId, status, ...(failureId ? { failureId } : {}) };
    if (status >= 500) log.error("backend-action.failed", error, fields);
    else log.warn("backend-action.rejected", fields);
    // A refusal for asking too often is the platform answering as it was
    // configured to, not work waiting for an administrator. Counting it put the
    // one thing nobody can act on at the top of the failure screen.
    if (status !== 429)
      await recordOperationalError(database, action, error, status, operationId, failureId);
    return { error, failureId, status };
  };

  try {
    const payload = asRecord(body.payload);
    if (!action) throw new Error("invalid-action");

    let segments: AsyncGenerator<ActionSegment>;
    let domain = "system";
    let logsCompletion = true;
    if (action === "healthcheck") {
      segments = healthcheckSegments(request, database);
    } else {
      const definition = getBackendActionDefinition(action);
      if (!definition) throw new Error("invalid-action");
      if (!firebaseUser) throw new Error("unauthenticated");
      const auth = await resolveAuthContext(database, firebaseUser);
      domain = definition.domain;
      logsCompletion = definition.rateLimitGroup !== "read" && definition.rateLimitGroup !== "upload-resolve";
      segments = executeBackendActionSegments(definition, payload, auth, database, operationId);
    }

    // The first piece is produced before the response exists, so an action that
    // fails outright is still an ordinary error response with its own status.
    const first = await segments.next();
    if (logsCompletion) {
      log.success("backend-action.completed", { action, domain, operationId, status: 200 });
    }
    const { pump, response } = streamingResponse(
      first.done ? { data: null } : first.value,
      segments,
      operationId,
      async (error) => publicErrorBody(error, (await recordFailure(error)).failureId),
      request.signal,
    );
    return { done: pump, response };
  } catch (error) {
    const { failureId } = await recordFailure(error);
    return { done: Promise.resolve(), response: errorResponse(error, operationId, failureId) };
  }
}
