import { asRecord, asString } from "../shared/http.ts";
import type { Json } from "../database/schema.ts";
import { hasPermission } from "./auth.ts";
import { claimBackendActionBusinessLimit } from "./rate-limit.ts";
import type { BackendActionDefinition } from "./action-registry.ts";
import type { AuthContext, BackendDatabase, JsonRecord } from "./types.ts";

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
    if (["content", "requestId", "resultContent"].includes(key)) continue;
    detail[key] = value as Json;
  }
  return detail;
}

async function recordAdminAudit(
  definition: BackendActionDefinition,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (definition.rateLimitGroup !== "admin-write" || definition.name === "setUserRestriction") {
    return;
  }
  const { error } = await database.table("app_private", "admin_audit_log").insert({
    actor_uid: auth.uid,
    action: definition.name,
    domain: definition.domain,
    target_id: auditTarget(payload),
    detail: auditDetail(payload),
  });
  if (error) console.error("admin-audit-write-failed", error);
}

async function runWithIdempotency(
  definition: BackendActionDefinition,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
  execute: () => Promise<unknown>,
) {
  const action = definition.name;
  const requestId = asString(payload.requestId);
  if (definition.requiresRequestId && !requestId) {
    throw new Error("validation-required");
  }
  if (!requestId || !definition.idempotent) {
    await claimBackendActionBusinessLimit(action, payload, auth.uid);
    return await execute();
  }

  const { data: claimData, error: claimError } = await database
    .call("app_api", "claim_idempotency_key", {
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
    await claimBackendActionBusinessLimit(action, payload, auth.uid);
    response = asRecord(await execute());
  } catch (error) {
    await database
      .call("app_api", "release_idempotency_key", {
        action_name: action,
        actor_uid: auth.uid,
        request_id: requestId,
      });
    throw error;
  }

  const { error: completeError } = await database
    .call("app_api", "complete_idempotency_key", {
      action_name: action,
      action_response: response,
      actor_uid: auth.uid,
      request_id: requestId,
    });
  if (completeError) throw completeError;
  return response;
}

export async function executeBackendAction(
  definition: BackendActionDefinition,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
) {
  if (auth.interactionRestricted && RESTRICTED_INTERACTION_ACTIONS.has(definition.name)) {
    throw new Error("user-muted");
  }
  if (definition.requiredPermission && !hasPermission(auth, definition.requiredPermission)) {
    throw new Error("permission-denied");
  }
  return await runWithIdempotency(
    definition,
    payload,
    auth,
    database,
    async () => {
      const result = await definition.handler(definition.name, payload, auth, database);
      await recordAdminAudit(definition, payload, auth, database);
      return result;
    },
  );
}
