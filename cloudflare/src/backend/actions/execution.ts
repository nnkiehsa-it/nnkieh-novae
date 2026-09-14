import type { Json, Selected } from "../database/schema.ts";
import type { AppDatabaseClient } from "../database/client.ts";
import { resolveDomainEvents } from "../events/domain-events.ts";
import { hasPermission } from "./auth.ts";
import { claimBackendActionBusinessLimit, claimBackendActionBurstLimit } from "./rate-limit.ts";
import type { BackendActionDefinition } from "./action-registry.ts";
import type { ActionSegment, AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { toApiJson } from "./response.ts";

const RESTRICTED_INTERACTION_ACTIONS = new Set([
  "createAnnouncementComment",
  "createComment",
  "createFacility",
  "createImageUploadSessions",
  "createIssue",
  "finalizeImageUploads",
  "setAnnouncementLike",
  "toggleFacilityAffected",
  "toggleSupport",
]);

function auditTarget(payload: JsonRecord) {
  const candidates = [
    payload.uid,
    payload.id,
    payload.categoryId,
    payload.issueId,
    payload.facilityId,
    payload.announcementId,
    payload.commentId,
  ];
  return candidates.find(
    (value): value is string => typeof value === "string" && value.length > 0,
  ) ?? null;
}

function auditDetail(payload: JsonRecord) {
  const detail: { [key: string]: Json | undefined } = {};
  for (const [key, value] of Object.entries(payload)) {
    if (["content", "resultContent"].includes(key)) continue;
    detail[key] = value as Json;
  }
  return detail;
}

export async function executeBackendAction(
  definition: BackendActionDefinition,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
  operationId: string,
) {
  if (auth.interactionRestricted && RESTRICTED_INTERACTION_ACTIONS.has(definition.name)) {
    throw new Error("user-muted");
  }
  if (definition.requiredPermission && !hasPermission(auth, definition.requiredPermission)) {
    throw new Error("permission-denied");
  }
  await claimBackendActionBurstLimit(definition.name, auth.uid);

  // Read-only actions execute directly without transaction or operation claiming.
  if (definition.rateLimitGroup === "read" || definition.rateLimitGroup === "upload-resolve") {
    const result = await definition.handler(definition.name, payload, auth, database);
    // An action that answers in pieces hands back the pieces themselves; they
    // are converted one at a time as they are sent.
    return isSegmentStream(result) ? result : toApiJson(result);
  }

  // All write actions execute within a single dedicated PostgreSQL transaction
  const client = database as AppDatabaseClient;
  return await client.transaction(async (tx) => {
    // 1. Claim operation atomically
    const { data: claimRows, error: claimError } = await tx
      .call("app_api", "claim_operation", {
        operation_id: operationId,
        actor_uid: auth.uid,
        action_name: definition.name,
      });
    if (claimError) throw claimError;
    const claim = Array.isArray(claimRows) ? claimRows[0] : null;
    if (!claim) throw new Error("operation-claim-failed");
    const identity = await tx.sqlOne<Selected<'operations', 'actor_uid' | 'action' | 'response_expired'>>`
      select actor_uid, action, response_expired from app_private.operations
      where operation_id = ${operationId}`;
    if (identity.actor_uid !== auth.uid || identity.action !== definition.name) throw new Error('permission-denied');
    if (identity.response_expired) throw new Error('operation-expired');
    if (claim.completed) return claim.response;
    if (!claim.claimed) throw new Error("request-in-progress");
    const { error: contextError } = await tx.call("app_api", "set_operation_context", {
      operation_id: operationId,
    });
    if (contextError) throw contextError;

    // 2. Enforce business rate limits
    await claimBackendActionBusinessLimit(definition.name, payload, auth.uid);

    // 3. Execute domain mutation
    const result = await definition.handler(definition.name, payload, auth, tx);

    // 4. Record admin audit log in the same transaction (fail on error, never swallow)
    if (definition.rateLimitGroup === "admin-write") {
      const targetId = auditTarget(payload);
      const detail = auditDetail(payload);
      const auditRow = await tx.sqlOne<Selected<"admin_audit_log", "id">>`
        insert into app_private.admin_audit_log (operation_id, actor_uid, action, domain, target_id, detail)
        values (${operationId}, ${auth.uid}, ${definition.name}, ${definition.domain}, ${targetId}, ${detail})
        returning id`;
      const auditId = String(auditRow.id);

      const { error: auditEventError } = await tx
        .call("app_api", "record_domain_event", {
          operation_id: operationId,
          aggregate_type: "admin_audit",
          aggregate_id: auditId,
          event_type: "admin.audit_recorded",
          actor_uid: auth.uid,
          payload: {
            audit_id: auditId,
            action: definition.name,
            actor_uid: auth.uid,
            domain: definition.domain,
            target_id: targetId,
            detail,
          },
          destinations: ["notion"],
        });
      if (auditEventError) throw auditEventError;
    }

    // 5. Record domain events and queue deliveries
    const domainEvents = resolveDomainEvents(definition.name, payload, result, auth.uid);
    for (const event of domainEvents) {
      const { error: eventError } = await tx
        .call("app_api", "record_domain_event", {
          operation_id: operationId,
          aggregate_type: event.aggregateType,
          aggregate_id: event.aggregateId,
          event_type: event.eventType,
          actor_uid: auth.uid,
          payload: event.payload,
          destinations: event.destinations,
        });
      if (eventError) throw eventError;
    }

    // 6. Complete operation
    const apiResult = toApiJson(result) as Json;
    const { error: completeError } = await tx
      .call("app_api", "complete_operation", {
        operation_id: operationId,
        action_response: apiResult,
      });
    if (completeError) throw completeError;

    return apiResult;
  });
}

function isSegmentStream(value: unknown): value is AsyncIterable<ActionSegment> {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as AsyncIterable<ActionSegment>)[Symbol.asyncIterator] === "function";
}

/**
 * One action's answer as it is sent: the pieces of an action that has them,
 * and a single piece for everything else.
 */
export async function* executeBackendActionSegments(
  definition: BackendActionDefinition,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
  operationId: string,
): AsyncGenerator<ActionSegment> {
  const result = await executeBackendAction(definition, payload, auth, database, operationId);
  if (!isSegmentStream(result)) {
    yield { data: result };
    return;
  }
  for await (const segment of result) {
    yield { data: toApiJson(segment.data), key: segment.key };
  }
}

/** The finished answer the pieces add up to. */
export async function collectActionSegments(segments: AsyncIterable<ActionSegment>) {
  let whole: unknown;
  let fields: JsonRecord | undefined;
  for await (const segment of segments) {
    if (segment.key === undefined) whole = segment.data;
    else (fields ??= {})[segment.key] = segment.data;
  }
  if (!fields) return whole;
  return { ...(whole && typeof whole === "object" && !Array.isArray(whole) ? whole as JsonRecord : {}), ...fields };
}
