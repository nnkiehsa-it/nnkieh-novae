import assert from "node:assert/strict";
import pg from "pg";
import { asRecord, callAction, database, integrationTest, ownerQuery, seedActor } from "./helpers.ts";

integrationTest("support rechecks status after waiting for concurrent moderation", async () => {
  const author = await seedActor("race-author"), voter = await seedActor("race-voter");
  const issue = asRecord(asRecord(await callAction("createIssue", { title: "Concurrent completion", content: "body", category: "proposal-a" }, author.auth)).issue);
  const observer = new pg.Client({ connectionString: process.env.DATABASE_OWNER_URL });
  await observer.connect();
  let pending: Promise<unknown> | undefined;
  try {
    await ownerQuery("begin");
    await ownerQuery(`update app_private.issues set status='completed' where id='${issue.id}'`);
    pending = callAction("toggleSupport", { issueId: issue.id }, voter.auth);
    void pending.catch(() => undefined);
    let waiting = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await observer.query("select 1 from pg_stat_activity where datname=current_database() and wait_event_type='Lock' and query like '%app_private.issues%' and query like '%for update%'");
      if (result.rowCount) { waiting = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    assert.ok(waiting, "the support operation must wait for the issue lock");
    await ownerQuery("commit");
    await assert.rejects(pending, /support-not-available/u);
    const stored = await database.sqlOne<{support_count:number}>`select support_count from app_private.issues where id=${issue.id}`;
    assert.equal(stored.support_count, 1);
  } finally {
    await ownerQuery("rollback");
    await pending?.catch(() => undefined);
    await observer.end();
  }
});

integrationTest("returning to review clears approval/deadline and deletion events retain the issue", async () => {
  const author = await seedActor("review-author"), admin = await seedActor("review-admin", { roles: ["platform-admin"] });
  const issue = asRecord(asRecord(await callAction("createIssue", { title: "Review dates", content: "body", category: "public-issues" }, author.auth)).issue);
  const approved = asRecord(asRecord(await callAction("moderateIssueStatus", { issueId: issue.id, status: "pending" }, admin.auth)).issue);
  assert.ok(approved.reviewApprovedAt);
  const reset = asRecord(asRecord(await callAction("moderateIssueStatus", { issueId: issue.id, status: "under-review" }, admin.auth)).issue);
  assert.equal(reset.reviewApprovedAt, null);
  assert.equal(reset.supportDeadlineAt, null);
  const discussion = asRecord(asRecord(await callAction("createIssue", { title: "Comments", content: "body", category: "proposal-a" }, author.auth)).issue);
  const comment = asRecord(asRecord(await callAction("createComment", { issueId: discussion.id, content: "comment" }, author.auth)).comment);
  await callAction("deleteComment", { commentId: comment.id, issueId: "untrusted-parent" }, author.auth);
  const event = await database.sqlOne<{aggregate_id:string;payload:{issue_id:string}}>`select aggregate_id,payload from app_private.domain_events where event_type='issue.comment_deleted' and payload->>'comment_id'=${comment.id}`;
  assert.equal(event.aggregate_id, discussion.id);
  assert.equal(event.payload.issue_id, discussion.id);
});
