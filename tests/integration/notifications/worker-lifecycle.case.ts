import { asRecord, assert, callAction, database, integrationTest, seedActor } from "./support.ts";

integrationTest("worker database lifecycles and maintenance RPC", async () => {
  const { data: categoryRows, error: categoryError } = await database.table("app_private", "issue_categories").select("id").eq("is_active", true).order("sort_order");
  if (categoryError) throw categoryError;
  const issueCategoryIds = (categoryRows ?? []).map((row) => String(row.id));
  assert.ok(issueCategoryIds.length > 0);
  const expiredOwner = await seedActor("expired-support-owner");
  const expiredIssueResult = asRecord(await callAction("createIssue", {
    category: issueCategoryIds[0],
    content: "Integration expired support content",
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
  const { error: deletionInsertError } = await database.table("app_private", "background_jobs")
    .insert({
      job_type: "deletion",
      next_attempt_at: new Date(0).toISOString(),
      payload: { target_id: deletionTarget, target_type: "integration-test" },
      scope_id: deletionTarget,
      status: "pending",
    });
  if (deletionInsertError) throw deletionInsertError;
  let deletionJob: { id: string; scope_id: string } | undefined;
  for (let batch = 0; batch < 10 && !deletionJob; batch += 1) {
    const { data: deletionJobs, error: deletionClaimError } = await database
      .call("app_api", "claim_background_jobs", { requested_batch_size: 1 });
    if (deletionClaimError) throw deletionClaimError;
    deletionJob = ((deletionJobs ?? []) as Array<{ id: string; scope_id: string }>)
      .find((job) => job.scope_id === deletionTarget);
  }
  assert.ok(deletionJob);
  const attemptId = crypto.randomUUID();
  const { error: deletionCompleteError } = await database.call("app_api", "complete_background_job", {
    attempt_id: attemptId,
    job_id: deletionJob.id,
  });
  if (deletionCompleteError) throw deletionCompleteError;

  const eventTarget = `integration-event-${crypto.randomUUID()}`;
  const opId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  await database.table("app_private", "operations").insert({
    action: "integrationTest",
    actor_uid: "integration-worker",
    operation_id: opId,
    response: { seeded: true },
    status: "completed",
  });
  await database.table("app_private", "domain_events").insert({
    actor_uid: "integration-worker",
    aggregate_id: eventTarget,
    aggregate_type: "integration-test",
    event_id: eventId,
    event_type: "issue.created",
    operation_id: opId,
    payload: { source: "local-verifier" },
  });
  const deliveryId = crypto.randomUUID();
  const { error: deliveryInsertError } = await database.table("app_private", "event_deliveries")
    .insert({
      next_attempt_at: new Date(0).toISOString(),
      destination: "notion",
      event_id: eventId,
      id: deliveryId,
      status: "pending",
    });
  if (deliveryInsertError) throw deliveryInsertError;

  const { data: claimedDeliveries, error: deliveryClaimError } = await database
    .call("app_api", "claim_event_deliveries", { target_destination: "notion", batch_size: 1 });
  if (deliveryClaimError) throw deliveryClaimError;
  const claimedDelivery = ((claimedDeliveries ?? []) as Array<{ delivery_id: string }>)
    .find((delivery) => delivery.delivery_id === deliveryId);
  assert.ok(claimedDelivery);

  const deliveryAttemptId = crypto.randomUUID();
  const { error: deliveryFailError } = await database.call("app_api", "fail_event_delivery", {
    attempt_id: deliveryAttemptId,
    delivery_id: deliveryId,
    error_info: { code: "simulated-failure" },
  });
  if (deliveryFailError) throw deliveryFailError;
  const { data: failedDelivery, error: failedDeliveryError } = await database.table("app_private", "event_deliveries")
    .select("last_attempt_id,status")
    .eq("id", deliveryId)
    .single();
  if (failedDeliveryError) throw failedDeliveryError;
  assert.equal(failedDelivery.status, "failed");
  assert.equal(failedDelivery.last_attempt_id, deliveryAttemptId);

  const { data: maintenance, error: maintenanceError } = await database
    .call("app_api", "run_scheduled_maintenance_cleanup");
  if (maintenanceError) throw maintenanceError;
  assert.ok(maintenance && typeof maintenance === "object");
});
