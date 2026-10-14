import type { Json, Selected } from "../database/schema.ts";
import type { AppDatabaseClient } from "../database/client.ts";
import { resolveDomainEvents } from "../events/domain-events.ts";
import { hasPermission } from "./auth.ts";
import { claimBackendActionBusinessLimit, claimBackendActionBurstLimit } from "./rate-limit.ts";
import * as v from "valibot";
import { ACTIONS, type ActionName } from "../../../../shared/actions.ts";
import { isWriteGroup } from "../../../../shared/contract.ts";
import { ACTION_HANDLERS } from "./registry.ts";
import { AccountAccessError } from "../shared/account-access.ts";
import type { ActionSegment, AuthContext, BackendDatabase, JsonRecord } from "./types.ts";
import { toApiJson } from "./response.ts";

/** Whether the account's access rules let it take this action at all. */
function assertAccountMayAct(name: ActionName, auth: AuthContext) {
  const { access, moderatedBy } = ACTION_HANDLERS[name];
  // A moderator removing content is moderating, not participating.
  const participation = access === "participation" && !(moderatedBy && hasPermission(auth, moderatedBy));
  if (
    (auth.accessPreset === "read_only" && (participation || access === "reaction"))
    || (auth.accessPreset === "reaction_only" && participation)
  ) {
    throw new AccountAccessError(auth.accessRestrictionMessage);
  }
}

/** A request the contract does not describe is refused before any work starts. */
function parseInput<N extends ActionName>(name: N, payload: JsonRecord) {
  const result = v.safeParse(ACTIONS[name].input, payload);
  if (result.success) return result.output;
  const message = result.issues[0]?.message ?? "";
  throw new Error(/^(validation|invalid)-/u.test(message) ? message : "validation-invalid");
}

function auditTarget(payload: JsonRecord) {
  const candidates = [
    payload.uid,
    payload.targetValue,
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

async function executeBackendAction(
  name: ActionName,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
  operationId: string,
) {
  const handler = ACTION_HANDLERS[name];
  assertAccountMayAct(name, auth);
  if (handler.permission && !hasPermission(auth, handler.permission)) {
    throw new Error("permission-denied");
  }
  const input = parseInput(name, payload);
  const run = handler.run as (input: unknown, auth: AuthContext, database: BackendDatabase) => ReturnType<typeof handler.run>;
  await claimBackendActionBurstLimit(name, auth.uid);

  // Read-only actions execute directly without transaction or operation claiming.
  if (!isWriteGroup(ACTIONS[name].group)) {
    const result = await run(input, auth, database);
    // An action that answers in pieces hands back the pieces themselves; they
    // are converted one at a time as they are sent.
    return isSegmentStream(result) ? result : toApiJson(result);
  }

  // All write actions execute within a single dedicated PostgreSQL transaction
  const client = database as AppDatabaseClient;
  return await client.transaction(async (tx) => {
    // 1. Claim operation atomically
    const claimRows = await tx
      .call("app_api", "claim_operation", {
        operation_id: operationId,
        actor_uid: auth.uid,
        action_name: name,
      });
    const claim = Array.isArray(claimRows) ? claimRows[0] : null;
    if (!claim) throw new Error("operation-claim-failed");
    const identity = await tx.sqlOne<Selected<'operations', 'actor_uid' | 'action' | 'response_expired'>>`
      select actor_uid, action, response_expired from app_private.operations
      where operation_id = ${operationId}`;
    if (identity.actor_uid !== auth.uid || identity.action !== name) throw new Error('permission-denied');
    if (identity.response_expired) throw new Error('operation-expired');
    if (claim.completed) return claim.response;
    if (!claim.claimed) throw new Error("request-in-progress");
    await tx.call("app_api", "set_operation_context", {
      operation_id: operationId,
    });

    // 2. Enforce business rate limits
    await claimBackendActionBusinessLimit(name, payload, auth.uid);

    // 3. Execute domain mutation
    const result = await run(input, auth, tx);

    // 4. Record admin audit log in the same transaction (fail on error, never swallow)
    if (ACTIONS[name].group === "admin-write") {
      const targetId = auditTarget(payload);
      const detail = auditDetail(payload);
      const auditRow = await tx.sqlOne<Selected<"admin_audit_log", "id">>`
        insert into app_private.admin_audit_log (operation_id, actor_uid, action, domain, target_id, detail)
        values (${operationId}, ${auth.uid}, ${name}, ${handler.domain}, ${targetId}, ${detail})
        returning id`;
      const auditId = String(auditRow.id);

      await tx
        .call("app_api", "record_domain_event", {
          operation_id: operationId,
          aggregate_type: "admin_audit",
          aggregate_id: auditId,
          event_type: "admin.audit_recorded",
          actor_uid: auth.uid,
          payload: {
            audit_id: auditId,
            action: name,
            actor_uid: auth.uid,
            domain: handler.domain,
            target_id: targetId,
            detail,
          },
          destinations: ["notion"],
        });
    }

    // 5. Record domain events and queue deliveries
    const domainEvents = resolveDomainEvents(name, payload, result, auth.uid);
    for (const event of domainEvents) {
      await tx
        .call("app_api", "record_domain_event", {
          operation_id: operationId,
          aggregate_type: event.aggregateType,
          aggregate_id: event.aggregateId,
          event_type: event.eventType,
          actor_uid: auth.uid,
          payload: event.payload,
          destinations: event.destinations,
        });
    }

    // 6. Complete operation
    const apiResult = toApiJson(result) as Json;
    await tx
      .call("app_api", "complete_operation", {
        operation_id: operationId,
        action_response: apiResult,
      });

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
  name: ActionName,
  payload: JsonRecord,
  auth: AuthContext,
  database: BackendDatabase,
  operationId: string,
): AsyncGenerator<ActionSegment> {
  const result = await executeBackendAction(name, payload, auth, database, operationId);
  if (!isSegmentStream(result)) {
    yield { data: conform(name, undefined, ACTIONS[name].output, result) };
    return;
  }
  for await (const segment of result) {
    yield shapePart(name, { data: toApiJson(segment.data), key: segment.key });
  }
}

/**
 * Every answer leaves through its contract: what the contract does not name is
 * dropped, so a column added to a table never reaches a browser by accident,
 * and an answer that does not fit is a failed request rather than a screen
 * reading a shape it was never promised.
 */
function shapePart(name: ActionName, segment: ActionSegment): ActionSegment {
  const output = ACTIONS[name].output as v.GenericSchema;
  if (output.type === "unknown") return segment;
  const entries = "entries" in output ? output.entries as Record<string, v.GenericSchema> : null;
  if (segment.key !== undefined) {
    const schema = entries?.[segment.key];
    if (!schema) throw new Error(`contract-violation: ${name} answered an undeclared part ${segment.key}`);
    return { data: conform(name, segment.key, schema, segment.data), key: segment.key };
  }
  if (!entries) return { data: conform(name, undefined, output, segment.data) };
  // The opening piece of an answer sent in pieces; the keyed parts complete it.
  const data = segment.data && typeof segment.data === "object" ? segment.data as JsonRecord : {};
  return {
    data: Object.fromEntries(Object.entries(data)
      .filter(([key]) => Object.hasOwn(entries, key))
      .map(([key, value]) => [key, conform(name, key, entries[key], value)])),
  };
}

function conform(name: ActionName, key: string | undefined, schema: v.GenericSchema, value: unknown) {
  const result = v.safeParse(schema, value);
  if (result.success) return result.output;
  const issue = result.issues[0];
  const path = [key, ...(issue.path ?? []).map((item) => String(item.key))].filter(Boolean).join(".");
  throw new Error(`contract-violation: ${name} ${path}: ${issue.message}`);
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
