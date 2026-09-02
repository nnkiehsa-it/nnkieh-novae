import assert from "node:assert/strict";
import {
  asRecord,
  callAction,
  database,
  integrationTest,
  ownerQuery,
  seedActor,
} from "./helpers.ts";
import { appendTimelineBlockWithDeduplication } from "../../cloudflare/src/backend/shared/notion.ts";
import { processInAppDeliveries, processRealtimeDeliveries } from "../../cloudflare/src/backend/jobs/deliveries.ts";
import type { Env } from "../../cloudflare/src/types.ts";
import type { RealtimeDelivery } from "../../cloudflare/src/durable/realtime-hub.ts";

async function rowCount(table: "admin_audit_log" | "domain_events" | "issues" | "operations", column: string, value: string) {
  const { count, error } = await database.table("app_private", table)
    .select(column, { count: "exact", head: true }).eq(column, value);
  if (error) throw error;
  return count ?? 0;
}

function assertCanonicalApiJson(value: unknown, path = "data") {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertCanonicalApiJson(entry, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    assert.equal(key.includes("_"), false, `${path}.${key} must be camelCase`);
    assert.equal(key.endsWith("AtMs"), false, `${path}.${key} must use an ISO timestamp`);
    if (key.endsWith("At") && entry !== null) {
      assert.equal(typeof entry, "string", `${path}.${key} must be an ISO string`);
      assert.equal(Number.isFinite(Date.parse(String(entry))), true, `${path}.${key} must be a valid ISO timestamp`);
    }
    assertCanonicalApiJson(entry, `${path}.${key}`);
  }
}

async function expectRollback(
  stage: "audit" | "claim" | "completion" | "event" | "mutation",
  operationId: string,
  execute: () => Promise<unknown>,
) {
  const marker = `fault-${stage}-${operationId}`;
  const trigger = `integration_fault_${stage}`;
  const functionName = `${trigger}_fn`;
  const target = stage === "mutation" ? "issues"
    : stage === "audit" ? "admin_audit_log"
    : stage === "event" ? "domain_events"
    : "operations";
  const predicate = stage === "mutation"
    ? `new.content = '${marker}'`
    : stage === "claim"
    ? `tg_op = 'INSERT' and new.operation_id = '${operationId}'::uuid`
    : stage === "completion"
    ? `new.operation_id = '${operationId}'::uuid and new.status = 'completed'`
    : `new.operation_id = '${operationId}'::uuid`;

  await ownerQuery(`
    create function app_private.${functionName}() returns trigger language plpgsql as $$
    begin
      if ${predicate} then raise exception 'integration-fault-${stage}'; end if;
      return new;
    end $$;
    create trigger ${trigger} before insert or update on app_private.${target}
    for each row execute function app_private.${functionName}();
  `);
  try {
    await assert.rejects(execute, new RegExp(`integration-fault-${stage}`, "u"));
  } finally {
    await ownerQuery(`
      drop trigger if exists ${trigger} on app_private.${target};
      drop function if exists app_private.${functionName}();
    `);
  }
  assert.equal(await rowCount("operations", "operation_id", operationId), 0);
  assert.equal(await rowCount("domain_events", "operation_id", operationId), 0);
  assert.equal(await rowCount("admin_audit_log", "operation_id", operationId), 0);
  return marker;
}

integrationTest("write transaction fault injection never leaves a partial commit", async () => {
  for (const stage of ["claim", "mutation", "event", "completion"] as const) {
    const actor = await seedActor(`transaction-${stage}`);
    const operationId = crypto.randomUUID();
    const marker = await expectRollback(stage, operationId, async () => await callAction("createIssue", {
      category: "public-issues",
      content: `fault-${stage}-${operationId}`,
      title: `Fault ${stage}`,
    }, actor.auth, operationId));
    assert.equal(await rowCount("issues", "content", marker), 0);
  }

  const admin = await seedActor("transaction-audit", { roles: ["platform-admin"] });
  const auditOperationId = crypto.randomUUID();
  await expectRollback("audit", auditOperationId, async () => await callAction("savePlatformFeatures", {
    announcementCommentsEnabled: true,
    facilitiesEnabled: true,
    issuesEnabled: true,
  }, admin.auth, auditOperationId));
});

integrationTest("concurrent retries with one operationId commit exactly one result", async () => {
  const actor = await seedActor("concurrent-operation");
  const operationId = crypto.randomUUID();
  const payload = {
    category: "public-issues",
    content: "Concurrent operation content",
    title: `Concurrent ${operationId.slice(0, 8)}`,
  };
  const [first, second] = await Promise.all([
    callAction("createIssue", payload, actor.auth, operationId),
    callAction("createIssue", payload, actor.auth, operationId),
  ]);
  assert.deepEqual(second, first);
  assert.equal(await rowCount("operations", "operation_id", operationId), 1);
  assert.equal(await rowCount("domain_events", "operation_id", operationId), 1);
  assert.equal(await rowCount("issues", "title", payload.title), 1);
  assert.equal(asRecord(asRecord(first).issue).id, asRecord(asRecord(second).issue).id);
  assertCanonicalApiJson(first);
});

integrationTest("Notion timeline pagination, retry deduplication, and duplicate repair converge", async () => {
  const baseUrl = process.env.NOTION_API_BASE_URL;
  assert.ok(baseUrl);
  const pageResponse = await fetch(`${baseUrl}/v1/pages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ properties: {} }),
  });
  assert.equal(pageResponse.ok, true);
  const page = await pageResponse.json() as { id: string };
  const eventId = crypto.randomUUID();
  const marker = `[eventId: ${eventId}]`;
  const paragraph = (content: string) => ({
    object: "block",
    type: "paragraph",
    paragraph: { rich_text: [{ type: "text", text: { content } }] },
  });
  const seededBlocks = Array.from({ length: 101 }, (_, index) => paragraph(`history-${index}`));
  seededBlocks.push(paragraph(`${marker} first`), paragraph(`${marker} duplicate`));
  const seedResponse = await fetch(`${baseUrl}/v1/blocks/${page.id}/children`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ children: seededBlocks }),
  });
  assert.equal(seedResponse.ok, true);

  await appendTimelineBlockWithDeduplication(page.id, eventId, "must not append again");
  await appendTimelineBlockWithDeduplication(page.id, eventId, "must remain idempotent");
  const repairedResponse = await fetch(`${baseUrl}/v1/blocks/${page.id}/children?page_size=100`);
  const repairedFirstPage = await repairedResponse.json() as { next_cursor: string | null; results: unknown[] };
  const repairedSecondPage = await fetch(
    `${baseUrl}/v1/blocks/${page.id}/children?page_size=100&start_cursor=${repairedFirstPage.next_cursor}`,
  ).then((response) => response.json()) as { results: Array<Record<string, unknown>> };
  const allBlocks = [...repairedFirstPage.results, ...repairedSecondPage.results] as Array<Record<string, unknown>>;
  const matching = allBlocks.filter((block) => JSON.stringify(block).includes(marker));
  assert.equal(matching.length, 1);

  const newEventId = crypto.randomUUID();
  await appendTimelineBlockWithDeduplication(page.id, newEventId, "append and verify");
  await appendTimelineBlockWithDeduplication(page.id, newEventId, "retry after ack loss");
});

integrationTest("realtime deliveries use subscriber topics and carry operation and revision correlation", async () => {
  const actor = await seedActor("realtime-correlation");
  const operationId = crypto.randomUUID();
  const created = asRecord(await callAction("createIssue", {
    category: "public-issues",
    content: "Realtime correlation content",
    title: "Realtime correlation",
  }, actor.auth, operationId));
  const issueId = String(asRecord(created.issue).id);
  const published: RealtimeDelivery[] = [];
  const env = {
    REALTIME: {
      getByName: () => ({
        publish: async (deliveries: RealtimeDelivery[]) => {
          published.push(...deliveries);
          return { delivered: deliveries.length };
        },
      }),
    },
  } as unknown as Env;

  await processInAppDeliveries(database, env);
  await processRealtimeDeliveries(database, env);
  const contentDeliveries = published.filter((delivery) => delivery.event === "content_changed");
  assert.deepEqual(
    contentDeliveries.map((delivery) => delivery.topic).sort(),
    [`content:admin`, `content:user:${actor.auth.uid}`].sort(),
  );
  for (const delivery of contentDeliveries) {
    assert.equal(delivery.id.length > 0, true);
    assert.equal(delivery.payload.operationId, operationId);
    assert.equal(delivery.payload.targetId, issueId);
    assert.equal(delivery.payload.eventType, "issue_changed");
    assert.equal(Number(delivery.payload.aggregateRevision) >= 1, true);
    assert.equal(Number(delivery.payload.domainRevision) >= 1, true);
  }
});
