import type { Json } from "../database/schema.ts";
import type { AppDatabaseClient } from "../database/client.ts";
import { resolveDomainEvents } from "../events/domain-events.ts";
import { hasPermission } from "./auth.ts";
import { claimBackendActionBusinessLimit } from "./rate-limit.ts";
import type { BackendActionDefinition } from "./action-registry.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
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

  // Read-only actions execute directly without transaction or operation claiming.
  if (definition.rateLimitGroup === "read" || definition.rateLimitGroup === "upload-resolve") {
    return toApiJson(await definition.handler(definition.name, payload, auth, database));
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
      let auditId = operationId;
      const { data: auditRow, error: auditError } = await tx
        .table("app_private", "admin_audit_log")
        .insert({
          operation_id: operationId,
          actor_uid: auth.uid,
          action: definition.name,
          domain: definition.domain,
          target_id: targetId,
          detail,
        })
        .select("id")
        .single();
      if (auditError) throw auditError;

      if (auditRow && typeof auditRow === "object" && "id" in auditRow) {
        auditId = String((auditRow as { id: number }).id);
      }

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
