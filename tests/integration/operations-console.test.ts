import assert from "node:assert/strict";
import { processBackgroundJobs } from "../../cloudflare/src/backend/jobs/background-jobs.ts";
import { asRecord, underPolicies, database, integrationTest, seedActor, callAction, testEnvironment } from "./helpers.ts";
import { DEFAULT_OPERATION_POLICIES } from '../../cloudflare/generated/operations';
import { runMaintenance } from '../../cloudflare/src/backend/jobs/maintenance';
import { processInAppDeliveries } from '../../cloudflare/src/backend/jobs/deliveries';
import { AppDatabaseClient } from '../../cloudflare/src/backend/database/client';

integrationTest("production background consumer executes retention batches and preserves fresh notifications", async () => {
  const oldId = crypto.randomUUID();
  const freshId = crypto.randomUUID();
  await database.query(`insert into app_private.notifications
    (id, source, type, target_type, target_id, title, created_at, expires_at)
    values ($1, 'broadcast', 'announcement_created', 'announcement', $3, 'old', now()-interval '40 days', now()-interval '10 days'),
      ($2, 'broadcast', 'announcement_created', 'announcement', $3, 'fresh', now(), now()+interval '30 days')`,
  [oldId, freshId, crypto.randomUUID()]);
  const { error } = await database.call("app_api", "run_scheduled_maintenance_cleanup");
  if (error) throw error;
  await underPolicies(() => processBackgroundJobs(database));
  const rows = await database.query<{ id: string }>("select id from app_private.notifications where id = any($1::uuid[])", [[oldId, freshId]]);
  assert.deepEqual(rows.rows.map(row => row.id), [freshId]);
  const jobs = await database.query<{ affected_rows: number; status: string }>("select affected_rows,status from app_private.background_jobs where job_type='retention_cleanup'");
  assert.ok(jobs.rows.some(job => job.status === "completed" && job.affected_rows > 0));
});

integrationTest('operations settings enforce administrator access, revision conflicts and live UID limits', async () => {
  const admin = await seedActor('operations-admin', { roles: ['platform-admin'] });
  const user = await seedActor('operations-user');
  const other = await seedActor('operations-other');
  const snapshot = asRecord(await callAction('getOperationsConsole', {}, admin.auth));
  assert.ok(Number(snapshot.databaseBytes) > 0);
  assert.ok(Array.isArray(snapshot.capacity));
  const diagnostics = asRecord(await callAction('getProviderDiagnostics', { provider: 'cloudflare' }, admin.auth));
  assert.equal(diagnostics.status, 'not-configured');
  await assert.rejects(() => callAction('getProviderDiagnostics', { provider: 'cloudflare' }, user.auth), /permission-denied/);
  await assert.rejects(() => callAction('getOperationsConsole', {}, user.auth), /permission-denied/);
  const runtime = asRecord(await callAction('getRuntimePolicies', {}, user.auth));
  assert.equal(runtime.revision, 1);
  assert.equal('backupIntervalHours' in asRecord(runtime.values), false);
  const update = { revision: 1, reason: 'Verify quota', values: { ...DEFAULT_OPERATION_POLICIES, preferenceWriteHourly: 1 } };
  await assert.rejects(() => callAction('saveOperationPolicies', update, user.auth), /permission-denied/);
  const saved = asRecord(await callAction('saveOperationPolicies', update, admin.auth));
  assert.equal(saved.revision, 2);
  await assert.rejects(() => callAction('saveOperationPolicies', update, admin.auth), /request-in-progress/);
  await callAction('markNotificationsOpened', {}, user.auth);
  await assert.rejects(() => callAction('markNotificationsOpened', {}, user.auth), /rate-limit.operation/);
  const independent = asRecord(await callAction('markNotificationsOpened', {}, other.auth));
  assert.ok(independent.openedAt);
  const rejectedId = crypto.randomUUID();
  await callAction('updatePushNotificationPreferences', { preferences: { comments: true } }, admin.auth, rejectedId);
  await assert.rejects(() => callAction('updatePushNotificationPreferences', { preferences: { comments: false } }, other.auth, rejectedId), /permission-denied/);
});

integrationTest('only administrators may retry failed operational work', async () => {
  const admin = await seedActor('retry-admin', { roles: ['platform-admin'] });
  const member = await seedActor('retry-member');
  const id = crypto.randomUUID();
  await database.query(`insert into app_private.background_jobs(id,job_type,status,last_attempt_id,error_detail)
    values($1,'deletion','failed',$2,'{"code":"upstream-unavailable"}'::jsonb)`, [id, crypto.randomUUID()]);
  await assert.rejects(() => callAction('retryOperationalWork', { kind: 'job', id }, member.auth), /permission-denied/);
  assert.equal(asRecord(await callAction('retryOperationalWork', { kind: 'job', id }, admin.auth)).success, true);
  const job = await database.query<{ status: string }>('select status from app_private.background_jobs where id=$1', [id]);
  assert.equal(job.rows[0].status,'pending');
  await assert.rejects(() => callAction('retryOperationalWork', { kind: 'job', id }, admin.auth), /validation-invalid/);
});

integrationTest("production background consumer applies announcement policy to existing content", async () => {
  const admin = await seedActor("policy-consumer", { roles: ["platform-admin"] });
  const result = asRecord(await callAction("createAnnouncement", { title: "Policy test", content: "Policy content" }, admin.auth));
  const announcement = asRecord(result.announcement);
  await callAction('savePlatformFeatures', { issuesEnabled: true, facilitiesEnabled: true, announcementCommentsEnabled: false }, admin.auth);
  for (let batch = 0; batch < 10; batch += 1) {
    if (!(await underPolicies(() => processBackgroundJobs(database))).hasMore) break;
  }
  const content = await database.query<{ comments_enabled: boolean }>("select comments_enabled from app_private.announcements where id=$1", [announcement.id]);
  assert.equal(content.rows[0]?.comments_enabled, false);
  const job = await database.query<{ status: string }>("select status from app_private.background_jobs where job_type='category_policy' and payload->>'policyType'='announcement-comments' order by created_at desc limit 1");
  assert.equal(job.rows[0].status, "completed");
});

integrationTest('stale job claims cannot overwrite a newer claim, including manual retry', async () => {
  const admin = await seedActor('fencing-admin', { roles: ['platform-admin'] });
  const id = crypto.randomUUID();
  await database.query(`insert into app_private.background_jobs(id,job_type,status) values($1,'deletion','pending')`,[id]);
  const first = await database.call('app_api','claim_background_jobs',{requested_batch_size:100});
  if(first.error) throw first.error;
  const old = first.data.find(job=>job.id===id)!;
  await database.query(`select app_api.fail_background_job($1,$2,'{"code":"test-failure"}'::jsonb)`,[id,old.last_attempt_id]);
  await callAction('retryOperationalWork',{kind:'job',id},admin.auth);
  const next = await database.call('app_api','claim_background_jobs',{requested_batch_size:100});
  if(next.error) throw next.error;
  const current = next.data.find(job=>job.id===id)!;
  assert.notEqual(old.last_attempt_id,current.last_attempt_id);
  await assert.rejects(()=>database.query('select app_api.complete_background_job($1,$2)',[id,old.last_attempt_id]),/stale-work-claim/);
  await database.query('select app_api.complete_background_job($1,$2)',[id,current.last_attempt_id]);
  assert.equal((await database.query<{status:string}>('select status from app_private.background_jobs where id=$1',[id])).rows[0].status,'completed');
});

integrationTest('expired deletion logs retain compact external cleanup identifiers and can be retried', async () => {
  const admin = await seedActor('backlog-admin', { roles: ['platform-admin'] });
  const id = crypto.randomUUID();
  await database.query(`insert into app_private.background_jobs(id,job_type,status,payload,error_detail,last_attempt_id)
    values($1,'deletion','failed','{"cloudinary_public_id":"orphan-asset","target_type":"issue","target_id":"deleted"}',
    '{"message":"large provider failure"}',$2)`,[id,crypto.randomUUID()]);
  await database.query('delete from app_private.background_jobs where id=$1',[id]);
  const backlog = await database.query<{payload:Record<string,unknown>}>('select payload from app_private.external_cleanup_backlog where job_id=$1',[id]);
  assert.equal(backlog.rows[0].payload.cloudinary_public_id,'orphan-asset');
  assert.equal(backlog.rows[0].payload.error_detail,undefined);
  await callAction('retryOperationalWork',{kind:'cleanup',id},admin.auth);
  assert.equal((await database.query('select job_id from app_private.external_cleanup_backlog where job_id=$1',[id])).rows.length,0);
  assert.equal((await database.query<{status:string}>('select status from app_private.background_jobs where id=$1',[id])).rows[0].status,'pending');
});

integrationTest('expired unreferenced domain events release operation storage while fresh events remain', async () => {
  const operation = crypto.randomUUID();
  const event = crypto.randomUUID();
  await database.query(`insert into app_private.operations(operation_id,actor_uid,action,status,response,expires_at,created_at)
    values($1,'retention-test','createIssue','completed','{}',now()-interval '40 days',now()-interval '41 days')`,[operation]);
  await database.query(`insert into app_private.domain_events(event_id,operation_id,event_type,aggregate_type,aggregate_id,actor_uid,occurred_at)
    values($1,$2,'issue.created','issue','expired','retention-test',now()-interval '40 days')`,[event,operation]);
  await database.query('select app_api.run_scheduled_maintenance_cleanup()');
  for(let i=0;i<10;i++) if(!(await underPolicies(() => processBackgroundJobs(database))).hasMore) break;
  assert.equal((await database.query('select event_id from app_private.domain_events where event_id=$1',[event])).rows.length,0);
  assert.equal((await database.query('select operation_id from app_private.operations where operation_id=$1',[operation])).rows.length,0);
});

integrationTest('administrator user pages and custom restriction duration are enforced', async () => {
  const admin = await seedActor('pagination-admin',{roles:['platform-admin']});
  const member = await seedActor('restriction-member');
  await database.query(`insert into app_private.user_profiles(uid,display_name)
    select 'page-user-'||lpad(n::text,3,'0'),'Page user '||n from generate_series(1,101) n`);
  const first = asRecord(await callAction('listAdminUsers',{query:'page-user-',page:0},admin.auth));
  const second = asRecord(await callAction('listAdminUsers',{query:'page-user-',page:1},admin.auth));
  assert.equal((first.users as unknown[]).length,80);
  assert.equal(first.truncated,true);
  assert.equal((second.users as unknown[]).length,21);
  assert.equal(second.truncated,false);
  const start = Date.now();
  const result = asRecord(await callAction('setUserRestriction',{uid:member.auth.uid,mode:'custom',durationHours:2,reason:'Custom duration test'},admin.auth));
  const delta = Date.parse(String(result.restrictedUntil))-start;
  assert.ok(delta >= 7200000 && delta < 7210000);
  await assert.rejects(()=>callAction('setUserRestriction',{uid:member.auth.uid,mode:'custom',durationHours:0,reason:'Invalid'},admin.auth),/validation-invalid/);
  await assert.rejects(()=>callAction('setUserRestriction',{uid:admin.auth.uid,mode:'custom',durationHours:2,reason:'Denied'},admin.auth),/permission-denied/);
});

integrationTest('runtime content limits apply below the wider database safety ceilings', async () => {
  const admin = await seedActor('content-policy-admin',{roles:['platform-admin']});
  await callAction('saveOperationPolicies',{ revision:1,reason:'Content limits test',values:{...DEFAULT_OPERATION_POLICIES,titleLength:150,contentLength:7000}},admin.auth);
  const result = asRecord(await callAction('createAnnouncement',{title:'T'.repeat(150),content:'C'.repeat(6000)},admin.auth));
  assert.equal(String(asRecord(result.announcement).title).length,150);
  await assert.rejects(()=>callAction('createAnnouncement',{title:'T'.repeat(151),content:'Valid content'},admin.auth));
  await assert.rejects(()=>callAction('saveOperationPolicies',{revision:2,reason:'Beyond safety ceiling',values:{...DEFAULT_OPERATION_POLICIES,titleLength:201}},admin.auth),/validation-invalid/);
});

integrationTest('Notion metadata expiry queues external archival and disabled Notion cannot falsely complete it', async () => {
  const pageId = crypto.randomUUID();
  await database.query(`insert into app_private.notion_pages(target_type,target_id,notion_page_id,updated_at)
    values('system-log','old-event',$1,now()-interval '400 days')`,[pageId]);
  await underPolicies(() => runMaintenance(database));
  assert.equal((await database.query('select target_id from app_private.notion_pages where notion_page_id=$1',[pageId])).rows.length,0);
  const queued = await database.query<{id:string}>(`select id from app_private.background_jobs where payload->>'notion_page_id'=$1`,[pageId]);
  assert.equal(queued.rows.length,1);
  await underPolicies(() => processBackgroundJobs(database));
  const result = await database.query<{status:string;error_detail:unknown}>('select status,error_detail from app_private.background_jobs where id=$1',[queued.rows[0].id]);
  assert.equal(result.rows[0].status,'failed');
  assert.ok(JSON.stringify(result.rows[0].error_detail).includes('notion-not-configured'));
});

integrationTest('expired replay bodies are compacted without deleting audit identity or repeating a write', async () => {
  const admin = await seedActor('response-retention-admin',{roles:['platform-admin']});
  const id = crypto.randomUUID();
  const input = { title:'Compaction test',content:'Original saved content' };
  await database.query(`insert into app_private.operations(operation_id,actor_uid,action,status,created_at,updated_at,expires_at)
    values($1,$2,'createAnnouncement','processing',now()-interval '2 days',now()-interval '2 days',now())`,[id,admin.auth.uid]);
  await callAction('createAnnouncement',input,admin.auth,id);
  await database.query(`update app_private.operations set expires_at=now()-interval '1 day' where operation_id=$1`,[id]);
  await database.query('select app_api.run_scheduled_maintenance_cleanup()');
  for(let i=0;i<10;i++) if(!(await underPolicies(() => processBackgroundJobs(database))).hasMore) break;
  const row = await database.query<{response:unknown;response_expired:boolean}>('select response,response_expired from app_private.operations where operation_id=$1',[id]);
  assert.equal(row.rows[0].response,null);
  assert.equal(row.rows[0].response_expired,true);
  await assert.rejects(()=>callAction('createAnnouncement',input,admin.auth,id),/operation-expired/);
  assert.equal((await database.query('select id from app_private.announcements where title=$1',[input.title])).rows.length,1);
});

integrationTest('notification persistence failure leaves delivery failed instead of reporting success', async () => {
  const admin = await seedActor('notification-fault-admin',{roles:['platform-admin']});
  await callAction('createAnnouncement',{title:'Notification fault',content:'Notification fault content'},admin.auth);
  class FailingNotificationDatabase extends AppDatabaseClient {
    override query<T extends Record<string,unknown>>(sql: string,values: unknown[] = []) {
      if (sql.startsWith('INSERT INTO "app_private"."notifications"')) return Promise.reject(new Error('simulated-notification-storage-failure'));
      return super.query<T>(sql,values);
    }
  }
  const failing = new FailingNotificationDatabase(String(testEnvironment.DATABASE_URL));
  try { await underPolicies(() => processInAppDeliveries(failing,testEnvironment)); }
  finally { await failing.close(); }
  const rows = await database.query<{status:string;error_detail:unknown}>(`select status,error_detail from app_private.event_deliveries where destination='in_app'`);
  assert.ok(rows.rows.length > 0);
  assert.ok(rows.rows.every(row=>row.status==='failed'));
  assert.ok(rows.rows.some(row=>JSON.stringify(row.error_detail).includes('simulated-notification-storage-failure')));
});
