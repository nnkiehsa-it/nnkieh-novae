import { asRecord, assert, callAction, database, integrationTest, requestId, seedActor } from "./support.ts";

integrationTest("worker database lifecycles and maintenance RPC", async () => {
  const { data: categoryRows, error: categoryError } = await database.table("app_private", "issue_categories").select("id").eq("is_active", true).order("sort_order");
  if (categoryError) throw categoryError;
  const issueCategoryIds = (categoryRows ?? []).map((row) => String(row.id));
  assert.ok(issueCategoryIds.length > 0);
  const expiredOwner = await seedActor("expired-support-owner");
  const expiredIssueResult = asRecord(await callAction("createIssue", {
    category: issueCategoryIds[0],
    content: "Integration expired support content",
    requestId: requestId("expired-support"),
    title: "Expired support",
  }, expiredOwner.auth));
  const expiredIssue = asRecord(expiredIssueResult.issue);
  const { error: expireSetupError } = await database.table("app_private", "issues")
    .update({
      support_deadline_at: new Date(Date.now() - 60_000).toISOString(),
      support_enabled: true,
      support_goal: 50,
      support_met_at: null,
      status: "pending",
    })
    .eq("id", String(expiredIssue.id));
  if (expireSetupError) throw expireSetupError;
  const { data: expiredCount, error: expireError } = await database
    .call("app_api", "reject_expired_support_issues");
  if (expireError) throw expireError;
  assert.equal(expiredCount, 1);
  const { data: rejectedIssue, error: rejectedIssueError } = await database
    .table("app_private", "issues")
    .select("status")
    .eq("id", String(expiredIssue.id))
    .single();
  if (rejectedIssueError) throw rejectedIssueError;
  assert.equal(rejectedIssue.status, "auto-rejected");

  const deletionTarget = `integration-deletion-${crypto.randomUUID()}`;
  const { error: deletionInsertError } = await database.table("app_private", "deletion_jobs")
    .insert({
      target_id: deletionTarget,
      target_type: "integration-test",
    });
  if (deletionInsertError) throw deletionInsertError;
  const { data: deletionJobs, error: deletionClaimError } = await database
    .call("app_api", "claim_deletion_jobs", { batch_size: 50 });
  if (deletionClaimError) throw deletionClaimError;
  const deletionJob = ((deletionJobs ?? []) as Array<{ id: string; target_id: string }>)
    .find((job) => job.target_id === deletionTarget);
  assert.ok(deletionJob);
  const { error: deletionCompleteError } = await database.call("app_api", "complete_deletion_job", { job_id: deletionJob.id });
  if (deletionCompleteError) throw deletionCompleteError;

  const outboxTarget = `integration-outbox-${crypto.randomUUID()}`;
  const { error: outboxInsertError } = await database.table("app_private", "outbox_events")
    .insert({
      actor_uid: "integration-worker",
      event_type: "integration.test",
      payload: { source: "local-verifier" },
      target_id: outboxTarget,
      target_type: "integration-test",
    });
  if (outboxInsertError) throw outboxInsertError;
  let outboxEvent: { id: string; target_id: string } | undefined;
  for (let batch = 0; batch < 10 && !outboxEvent; batch += 1) {
    const { data: outboxEvents, error: outboxClaimError } = await database
      .call("app_api", "claim_outbox_events", { batch_size: 100 });
    if (outboxClaimError) throw outboxClaimError;
    outboxEvent = ((outboxEvents ?? []) as Array<{ id: string; target_id: string }>)
      .find((event) => event.target_id === outboxTarget);
  }
  assert.ok(outboxEvent);
  const errorTraceId = crypto.randomUUID();
  const { error: outboxFailError } = await database.call("app_api", "fail_outbox_event", {
      error_trace_id: errorTraceId,
      event_id: outboxEvent.id,
    });
  if (outboxFailError) throw outboxFailError;
  const { data: failedOutbox, error: failedOutboxError } = await database.table("app_private", "outbox_events")
    .select("error_trace_id")
    .eq("id", outboxEvent.id)
    .single();
  if (failedOutboxError) throw failedOutboxError;
  assert.equal(failedOutbox.error_trace_id, errorTraceId);
  const { error: legacyFailError } = await database.call("app_api", "fail_outbox_event", {
      error_message: "legacy-format-must-not-exist",
      event_id: outboxEvent.id,
    } as never);
  assert.ok(legacyFailError, "legacy error_message RPC parameter must be removed");

  const { data: maintenance, error: maintenanceError } = await database
    .call("app_api", "run_scheduled_maintenance_cleanup");
  if (maintenanceError) throw maintenanceError;
  assert.ok(maintenance && typeof maintenance === "object");
});
