import { asRecord, assert, callAction, database, insertRows, integrationTest, seedActor } from "./support.ts";

integrationTest("worker database lifecycles and maintenance RPC", async () => {
  const { rows: categoryRows } = await database.sql<{ id: string }>`
    select id from app_private.issue_categories where is_active = true order by sort_order`;
  const issueCategoryIds = categoryRows.map((row) => row.id);
  assert.ok(issueCategoryIds.length > 0);
  const expiredOwner = await seedActor("expired-support-owner");
  const expiredIssueResult = asRecord(await callAction("createIssue", {
    category: issueCategoryIds[0],
    content: "Integration expired support content",
    title: "Expired support",
  }, expiredOwner.auth));
  const expiredIssue = asRecord(expiredIssueResult.issue);
  await database.sql`update app_private.issues set
    support_deadline_at = ${new Date(Date.now() - 60_000).toISOString()},
    support_enabled = true, support_goal = 50, support_met_at = null, status = 'pending'
    where id = ${String(expiredIssue.id)}`;
  const { data: expiredCount, error: expireError } = await database
    .call("app_api", "reject_expired_support_issues");
  if (expireError) throw expireError;
  assert.equal(expiredCount, 1);
  const rejectedIssue = await database.sqlOne<{ status: string }>`
    select status from app_private.issues where id = ${String(expiredIssue.id)}`;
  assert.equal(rejectedIssue.status, "auto-rejected");

  const deletionTarget = `integration-deletion-${crypto.randomUUID()}`;
  await insertRows("background_jobs", [{
    job_type: "deletion",
    next_attempt_at: new Date(0).toISOString(),
    payload: { target_id: deletionTarget, target_type: "integration-test" },
    scope_id: deletionTarget,
    status: "pending",
  }]);
  let deletionJob: { id: string; scope_id: string; last_attempt_id: string } | undefined;
  for (let batch = 0; batch < 10 && !deletionJob; batch += 1) {
    const { data: deletionJobs, error: deletionClaimError } = await database
      .call("app_api", "claim_background_jobs", { requested_batch_size: 1 });
    if (deletionClaimError) throw deletionClaimError;
    deletionJob = ((deletionJobs ?? []) as Array<{ id: string; scope_id: string; last_attempt_id: string }>)
      .find((job) => job.scope_id === deletionTarget);
  }
  assert.ok(deletionJob);
  const attemptId = deletionJob.last_attempt_id;
  const { error: deletionCompleteError } = await database.call("app_api", "complete_background_job", {
    attempt_id: attemptId,
    job_id: deletionJob.id,
  });
  if (deletionCompleteError) throw deletionCompleteError;

  const eventTarget = `integration-event-${crypto.randomUUID()}`;
  const opId = crypto.randomUUID();
  const eventId = crypto.randomUUID();
  await insertRows("operations", [{
    action: "integrationTest",
    actor_uid: "integration-worker",
    operation_id: opId,
    response: { seeded: true },
    status: "completed",
  }]);
  await insertRows("domain_events", [{
    actor_uid: "integration-worker",
    aggregate_id: eventTarget,
    aggregate_type: "integration-test",
    event_id: eventId,
    event_type: "issue.created",
    operation_id: opId,
    payload: { source: "local-verifier" },
  }]);
  const deliveryId = crypto.randomUUID();
  await insertRows("event_deliveries", [{
    next_attempt_at: new Date(0).toISOString(),
    destination: "notion",
    event_id: eventId,
    id: deliveryId,
    status: "pending",
  }]);

  const { data: claimedDeliveries, error: deliveryClaimError } = await database
    .call("app_api", "claim_event_deliveries", { target_destination: "notion", batch_size: 1 });
  if (deliveryClaimError) throw deliveryClaimError;
  const claimedDelivery = ((claimedDeliveries ?? []) as Array<{ delivery_id: string; last_attempt_id: string }>)
    .find((delivery) => delivery.delivery_id === deliveryId);
  assert.ok(claimedDelivery);

  const deliveryAttemptId = claimedDelivery.last_attempt_id;
  const { error: deliveryFailError } = await database.call("app_api", "fail_event_delivery", {
    attempt_id: deliveryAttemptId,
    delivery_id: deliveryId,
    error_info: { code: "simulated-failure" },
  });
  if (deliveryFailError) throw deliveryFailError;
  const failedDelivery = await database.sqlOne<{ last_attempt_id: string; status: string }>`
    select last_attempt_id, status from app_private.event_deliveries where id = ${deliveryId}`;
  assert.equal(failedDelivery.status, "failed");
  assert.equal(failedDelivery.last_attempt_id, deliveryAttemptId);

  const { data: maintenance, error: maintenanceError } = await database
    .call("app_api", "run_scheduled_maintenance_cleanup");
  if (maintenanceError) throw maintenanceError;
  assert.ok(maintenance && typeof maintenance === "object");
});
