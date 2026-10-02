import assert from "node:assert/strict";
import { asRecord, callAction, database, integrationTest, processPlatformJobs, seedActor } from "./helpers";

integrationTest("disabling cleanup reports expiry updates, supersedes failed policies and preserves unrelated data", async () => {
  const admin = await seedActor("retention-disable-admin", { roles: ["platform-admin"] });
  const management = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  const settings = asRecord(management.platformSettings);
  const retention = asRecord(settings.retention);
  const notificationId = crypto.randomUUID();
  const announcementId = crypto.randomUUID();
  const failedId = crypto.randomUUID();
  await database.sql`insert into app_private.notifications(id,source,type,target_type,target_id,title,created_at,expires_at)
    values (${notificationId}, 'broadcast', 'retention-test', 'announcement', ${announcementId}, 'Retain notification', now()-interval '40 days', now()-interval '10 days')`;
  await database.sql`insert into app_private.announcements(id,author_uid,title,content,published_at)
    values (${announcementId}, ${admin.auth.uid}, 'Unrelated expired announcement', 'Preserve when disabling another rule', now()-interval '3000 days')`;
  await database.sql`insert into app_private.background_jobs(id,job_type,payload,status,error_detail,last_attempt_id)
    values (${failedId}, 'retention_cleanup', ${JSON.stringify({ ...retention, policyType: "retention-cleanup" })}::jsonb, 'failed', '{"code":"old-failure"}'::jsonb, ${crypto.randomUUID()})`;
  const input = { imageUploads: settings.imageUploads, retention: { ...retention, notificationsEnabled: false, closedIssuesEnabled: false } };
  const estimate = asRecord(await callAction("estimateRetentionCleanup", input, admin.auth));
  assert.equal(estimate.totalDeletedRows, 0);
  assert.ok(Number(estimate.totalUpdatedRows) >= 1);
  const saved = asRecord(await callAction("savePlatformSettings", input, admin.auth));
  assert.equal(saved.totalDeletedRows, 0);
  assert.ok(saved.jobId);
  assert.equal((await database.sqlOne<{ status: string }>`select status from app_private.background_jobs where id=${failedId}`).status, "superseded");
  await processPlatformJobs(1);
  assert.equal((await database.sqlOne<{ expiry: string }>`select expires_at::text as expiry from app_private.notifications where id=${notificationId}`).expiry, "infinity");
  assert.equal((await database.sqlOne<{ count: number }>`select count(*)::integer as count from app_private.announcements where id=${announcementId}`).count, 1);
  const imageOnly = { ...input, imageUploads: { ...asRecord(settings.imageUploads), maxDimension: 1800 } };
  const noImpact = asRecord(await callAction("estimateRetentionCleanup", imageOnly, admin.auth));
  assert.equal(noImpact.totalEstimatedRows, 0);
  assert.equal(asRecord(await callAction("savePlatformSettings", imageOnly, admin.auth)).jobId, null);
});

integrationTest("extending notification retention preserves expired rows before their expiry update batch", async () => {
  const admin = await seedActor("retention-extend-admin", { roles: ["platform-admin"] });
  const management = asRecord(await callAction("getCategoryManagement", {}, admin.auth));
  const settings = asRecord(management.platformSettings);
  const id = crypto.randomUUID();
  await database.sql`insert into app_private.notifications(id,source,type,target_type,target_id,title,created_at,expires_at)
    values (${id}, 'broadcast', 'retention-test', 'issue', ${id}, 'Extended notification', now()-interval '50 days', now()-interval '20 days')`;
  const input = { imageUploads: settings.imageUploads, retention: { ...asRecord(settings.retention), notificationsDays: 60 } };
  const estimate = asRecord(await callAction("estimateRetentionCleanup", input, admin.auth));
  assert.equal(estimate.totalDeletedRows, 0);
  assert.ok(Number(estimate.totalUpdatedRows) >= 1);
  await callAction("savePlatformSettings", input, admin.auth);
  await processPlatformJobs(1);
  assert.equal((await database.sqlOne<{ retained: boolean }>`select expires_at > now() as retained from app_private.notifications where id=${id}`).retained, true);
});
