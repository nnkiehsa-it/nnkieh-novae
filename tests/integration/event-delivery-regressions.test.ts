import assert from "node:assert/strict";
import { asRecord, callAction, database, integrationTest, seedActor, testEnvironment, underPolicies } from "./helpers.ts";
import { processRealtimeDeliveries } from "../../cloudflare/src/backend/jobs/realtime-deliveries.ts";
import { resolveRecipients } from "../../cloudflare/src/backend/jobs/delivery-recipients.ts";
import type { EventDeliveryItem } from "../../cloudflare/src/backend/jobs/delivery-attempt.ts";
import type { Env } from "../../cloudflare/src/types.ts";

integrationTest("deleted proposals notify saved supporters and private comments reach owner and category manager", async () => {
  await database.sql`update app_private.issue_categories set comments_enabled=true where id='rights-maintenance'`;
  const author = await seedActor("private-author"), manager = await seedActor("private-manager", { categoryIds: ["rights-maintenance"] });
  const issue = asRecord(asRecord(await callAction("createIssue", { title: "Private discussion", content: "body", category: "rights-maintenance" }, author.auth)).issue);
  const comment = asRecord(asRecord(await callAction("createComment", { issueId: issue.id, content: "manager reply" }, manager.auth)).comment);
  const deliveries: Array<{topic:string;payload:Record<string,unknown>}> = [];
  const env = { ...testEnvironment, REALTIME: { getByName: () => ({ publish: async (rows: typeof deliveries) => { deliveries.push(...rows); } }) } } as unknown as Env;
  await underPolicies(() => processRealtimeDeliveries(database, env));
  const topics = deliveries.filter((row) => row.payload.targetId === comment.id).map((row) => row.topic);
  assert.ok(topics.includes(`content:user:${author.auth.uid}`));
  assert.ok(topics.includes(`content:user:${manager.auth.uid}`));
  assert.equal(topics.includes("content:school"), false);
  const recipients = await resolveRecipients(database, { event_type: "issue.deleted", aggregate_id: String(issue.id), actor_uid: manager.auth.uid, payload: { author_uid: author.auth.uid, supporter_uids: ["saved-supporter", manager.auth.uid] } } as unknown as EventDeliveryItem);
  assert.ok(recipients.includes("saved-supporter"));
  assert.equal(recipients.includes(manager.auth.uid), false);
});
