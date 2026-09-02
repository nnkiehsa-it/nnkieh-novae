-- 0016_system_data_consistency.sql
-- Full system data consistency refactoring and one-time forward migration.

-- Replace retention settings owned by the removed outbox, idempotency,
-- realtime queue, push-delivery log, deletion-job, maintenance-run, and
-- platform-job models with the canonical operation/delivery/job settings.
update app_private.runtime_settings
set value = (
      value::jsonb - array[
        'outboxCompletedDays', 'outboxFailedDays', 'idempotencyHours',
        'realtimeEventsHours', 'pushDeliverySentDays', 'pushDeliveryFailedDays',
        'deletionJobCompletedDays', 'deletionJobFailedDays',
        'maintenanceRunsDays', 'platformJobsDays'
      ]::text[]
      || jsonb_build_object(
        'deliveryCompletedDays', coalesce(value::jsonb -> 'deliveryCompletedDays', value::jsonb -> 'outboxCompletedDays', '3'::jsonb),
        'deliveryFailedDays', coalesce(value::jsonb -> 'deliveryFailedDays', value::jsonb -> 'outboxFailedDays', '14'::jsonb),
        'operationHours', coalesce(value::jsonb -> 'operationHours', value::jsonb -> 'idempotencyHours', '24'::jsonb),
        'backgroundJobCompletedDays', coalesce(value::jsonb -> 'backgroundJobCompletedDays', value::jsonb -> 'deletionJobCompletedDays', '3'::jsonb),
        'backgroundJobFailedDays', coalesce(value::jsonb -> 'backgroundJobFailedDays', value::jsonb -> 'deletionJobFailedDays', '30'::jsonb)
      )
    )::text,
    updated_at = now()
where key = 'data_retention_settings';

create or replace function app_private.assert_retention_config(retention_config jsonb)
returns void
language plpgsql
immutable
set search_path to 'app_private', 'pg_catalog'
as $$
declare
  setting_key text;
begin
  if jsonb_typeof(retention_config) <> 'object' then
    raise exception 'validation-required';
  end if;
  foreach setting_key in array array[
    'closedIssuesEnabled', 'closedFacilitiesEnabled', 'announcementsEnabled',
    'notificationsEnabled', 'inactiveAvatarsEnabled', 'inactiveProfilePiiEnabled',
    'expiredRestrictionsEnabled'
  ] loop
    perform app_private.retention_boolean(retention_config, setting_key);
  end loop;
  foreach setting_key in array array[
    'closedIssuesDays', 'closedFacilitiesDays', 'announcementsDays', 'notificationsDays',
    'deliveryCompletedDays', 'deliveryFailedDays', 'operationHours',
    'inactivePushTokensDays', 'pushTokenConfirmationDays', 'inactiveAvatarsDays',
    'inactiveProfilePiiDays', 'expiredRestrictionsDays',
    'backgroundJobCompletedDays', 'backgroundJobFailedDays',
    'roleAssignmentAuditDays', 'adminAuditDays', 'categoryConfigurationAuditDays',
    'accessAssignmentAuditDays', 'pendingUploadHours', 'unattachedUploadHours',
    'failedUploadHours'
  ] loop
    perform app_private.retention_integer(retention_config, setting_key);
  end loop;
end;
$$;

-- 1. Operations table (Authoritative single operation tracking, replacing idempotency_keys)
alter table app_private.admin_audit_log add column operation_id uuid;

create table app_private.operations (
  operation_id uuid primary key,
  actor_uid text not null,
  action text not null,
  status text not null check (status in ('processing', 'completed', 'failed')),
  response jsonb,
  error_detail jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default app_private.runtime_retention_deadline('operationHours')
);

create index operations_claim_idx on app_private.operations(actor_uid, action, operation_id);
create index operations_expiry_idx on app_private.operations(expires_at);
create index operations_status_idx on app_private.operations(status, updated_at);
alter table app_private.operations
  add constraint operations_lifecycle_check check (
    updated_at >= created_at
    and expires_at >= created_at
    and (status <> 'completed' or response is not null)
    and (status <> 'failed' or error_detail is not null)
  );

alter table app_private.admin_audit_log
  add constraint admin_audit_log_operation_id_fkey
  foreign key (operation_id) references app_private.operations(operation_id);
create unique index admin_audit_log_operation_id_key
  on app_private.admin_audit_log(operation_id) where operation_id is not null;

-- 2. Domain Events table (Immutable event log tied to operations)
create table app_private.domain_events (
  event_id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references app_private.operations(operation_id),
  aggregate_type text not null,
  aggregate_id text not null,
  event_type text not null,
  actor_uid text not null,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  aggregate_version integer not null default 1
);

create index domain_events_operation_idx on app_private.domain_events(operation_id);
create index domain_events_aggregate_idx on app_private.domain_events(aggregate_type, aggregate_id, aggregate_version);
create index domain_events_occurred_idx on app_private.domain_events(occurred_at desc);
alter table app_private.domain_events
  add constraint domain_events_version_positive check (aggregate_version >= 1);

-- 3. Event Deliveries table (Per-destination delivery tracking: notion, in_app, push, realtime)
create table app_private.event_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references app_private.domain_events(event_id) on delete cascade,
  destination text not null check (destination in ('notion', 'in_app', 'push', 'realtime')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  last_attempt_id uuid,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  completed_at timestamptz,
  error_detail jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default app_private.runtime_retention_deadline('deliveryCompletedDays'),
  constraint event_deliveries_event_destination_key unique (event_id, destination)
);

create index event_deliveries_claim_idx on app_private.event_deliveries(destination, status, next_attempt_at)
  where status in ('pending', 'failed');
create index event_deliveries_locked_idx on app_private.event_deliveries(locked_at)
  where status = 'processing';
create index event_deliveries_expiry_idx on app_private.event_deliveries(expires_at)
  where status in ('completed', 'failed');
alter table app_private.event_deliveries
  add constraint event_deliveries_lifecycle_check check (
    attempt_count >= 0
    and updated_at >= created_at
    and expires_at >= created_at
    and (status <> 'processing' or locked_at is not null)
    and (status <> 'completed' or (completed_at is not null and last_attempt_id is not null))
    and (status <> 'failed' or (error_detail is not null and last_attempt_id is not null))
  );

-- 4. Background Jobs table (Unified deletion, retention cleanup, notion reconcile, category policy)
alter table app_private.push_tokens drop column if exists topic_broadcast;

create table app_private.background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null check (job_type in ('deletion', 'retention_cleanup', 'notion_reconcile', 'category_policy')),
  scope_id text not null default 'global',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed', 'superseded')),
  estimated_rows bigint not null default 0,
  processed_rows bigint not null default 0,
  affected_rows bigint not null default 0,
  batch_size integer not null default 100,
  attempt_count integer not null default 0,
  last_attempt_id uuid,
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb not null default '{}'::jsonb,
  error_detail jsonb,
  created_by text not null default 'system',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default app_private.runtime_retention_deadline('backgroundJobCompletedDays')
);

create index background_jobs_claim_idx on app_private.background_jobs(status, next_attempt_at)
  where status in ('pending', 'failed');
create index background_jobs_locked_idx on app_private.background_jobs(locked_at)
  where status = 'processing';
create index background_jobs_type_scope_idx on app_private.background_jobs(job_type, scope_id, created_at desc);
alter table app_private.background_jobs
  add constraint background_jobs_lifecycle_check check (
    estimated_rows >= 0
    and processed_rows >= 0
    and affected_rows >= 0
    and batch_size > 0
    and attempt_count >= 0
    and updated_at >= created_at
    and expires_at >= created_at
    and (status <> 'completed' or completed_at is not null)
    and (status <> 'failed' or (error_detail is not null and last_attempt_id is not null))
  );

-- 5. Canonical Notion Pages
-- Remove managed_block_ids and content_hash; clean orphans; enforce uniqueness
delete from app_private.notion_pages page
where (target_type = 'announcement' and not exists(select 1 from app_private.announcements where id::text = page.target_id))
   or (target_type = 'admin-audit' and not exists(select 1 from app_private.admin_audit_log where id::text = page.target_id))
   or (target_type = 'issue' and not exists(select 1 from app_private.issues where id::text = page.target_id))
   or (target_type = 'facility' and not exists(select 1 from app_private.facility_reports where id::text = page.target_id))
   or page.notion_page_id like 'pending:%';

-- Deduplicate any existing notion_pages rows by (target_type, target_id)
delete from app_private.notion_pages p1
where exists (
  select 1 from app_private.notion_pages p2
  where p2.target_type = p1.target_type and p2.target_id = p1.target_id and (p2.updated_at > p1.updated_at or (p2.updated_at = p1.updated_at and p2.ctid > p1.ctid))
);
delete from app_private.notion_pages p1
where exists (
  select 1 from app_private.notion_pages p2
  where p2.notion_page_id = p1.notion_page_id and (p2.updated_at > p1.updated_at or (p2.updated_at = p1.updated_at and p2.ctid > p1.ctid))
);

alter table app_private.notion_pages
  drop column if exists managed_block_ids,
  drop column if exists content_hash;

alter table app_private.notion_pages
  add constraint notion_pages_target_unique unique (target_type, target_id),
  add constraint notion_pages_page_id_unique unique (notion_page_id);

-- 6. Add revision column and automatic revision bump to mutable aggregates
alter table app_private.issues
  add column revision integer not null default 1;
alter table app_private.facility_reports
  add column revision integer not null default 1;
alter table app_private.announcements
  add column revision integer not null default 1;
alter table app_private.comments
  add column revision integer not null default 1;
alter table app_private.announcement_comments
  add column revision integer not null default 1;

alter table app_private.notifications
  add column origin text not null default 'live' check (origin in ('live', 'migration'));

create function app_private.bump_aggregate_revision()
returns trigger
language plpgsql
as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;

create trigger bump_issues_revision
  before update on app_private.issues
  for each row execute function app_private.bump_aggregate_revision();

create trigger bump_facility_reports_revision
  before update on app_private.facility_reports
  for each row execute function app_private.bump_aggregate_revision();

create trigger bump_announcements_revision
  before update on app_private.announcements
  for each row execute function app_private.bump_aggregate_revision();

create trigger bump_comments_revision
  before update on app_private.comments
  for each row execute function app_private.bump_aggregate_revision();

create trigger bump_announcement_comments_revision
  before update on app_private.announcement_comments
  for each row execute function app_private.bump_aggregate_revision();

-- 7. Exact recalculation of counters and non-negative constraints
update app_private.issues i
set support_count = (
  select count(*) from app_private.supports s where s.issue_id = i.id
);

update app_private.announcements a
set like_count = (
  select count(*) from app_private.announcement_likes al where al.announcement_id = a.id
),
comment_count = (
  select count(*) from app_private.announcement_comments ac where ac.announcement_id = a.id
);

update app_private.facility_reports f
set affected_count = (
  1 + (select count(*) from app_private.facility_report_affected_users fau where fau.facility_id = f.id)
);

-- Recompute platform_category_counters
update app_private.platform_category_counters c
set issues = coalesce((select count(*) from app_private.issues where category = c.category), 0),
    comments = coalesce((
      select count(*) from app_private.comments com
      join app_private.issues iss on iss.id = com.issue_id
      where iss.category = c.category
    ), 0);

-- Recompute platform_counters
update app_private.platform_counters
set value = (select count(*) from app_private.issues), updated_at = now()
where key = 'issues';

update app_private.platform_counters
set value = (select count(*) from app_private.comments), updated_at = now()
where key = 'comments';

update app_private.platform_counters
set value = (select count(*) from app_private.supports), updated_at = now()
where key = 'supports';

update app_private.platform_counters
set value = (select count(*) from app_private.announcements), updated_at = now()
where key = 'announcements';

update app_private.platform_counters
set value = (select count(*) from app_private.facility_reports), updated_at = now()
where key = 'facilities';

alter table app_private.issues
  add constraint issues_support_count_nonnegative check (support_count >= 0);
alter table app_private.announcements
  add constraint announcements_like_count_nonnegative check (like_count >= 0),
  add constraint announcements_comment_count_nonnegative check (comment_count >= 0);
alter table app_private.facility_reports
  add constraint facility_reports_affected_count_nonnegative check (affected_count >= 0);

-- 8. Reconstruct 30-day provable in-app notifications marked as migration-origin
-- Keep existing notifications within 30 days and mark them as migration
update app_private.notifications
set origin = 'migration'
where created_at >= now() - interval '30 days';

-- Clean notifications older than 30 days that are expired
delete from app_private.notifications
where created_at < now() - interval '30 days' and expires_at < now();

-- 9. Rebuild deletion background jobs for failed/unattached uploads
insert into app_private.background_jobs (job_type, scope_id, payload, created_by)
select
  'deletion',
  'global',
  jsonb_build_object(
    'target_type', 'upload',
    'target_id', id::text,
    'cloudinary_public_id', cloudinary_public_id
  ),
  'migration:0016'
from app_private.uploads
where cloudinary_public_id is not null
  and (status = 'failed' or (status = 'ready' and attached_target_id is null and updated_at < now() - interval '48 hours'));

-- Enqueue initial Notion reconcile job
insert into app_private.background_jobs (job_type, scope_id, payload, created_by)
values ('notion_reconcile', 'global', '{}'::jsonb, 'migration:0016');

-- 10. Drop legacy triggers that wrote to outbox_events and realtime_events
drop trigger if exists queue_issue_change_outbox on app_private.issues;
drop trigger if exists queue_issue_realtime_on_insert on app_private.issues;
drop trigger if exists queue_issue_realtime_on_update on app_private.issues;
drop trigger if exists queue_issue_realtime_on_delete on app_private.issues;

drop trigger if exists queue_issue_comment_realtime_on_insert on app_private.comments;
drop trigger if exists queue_issue_comment_realtime_on_update on app_private.comments;
drop trigger if exists queue_issue_comment_realtime_on_delete on app_private.comments;
drop trigger if exists queue_comment_created_outbox on app_private.comments;

drop trigger if exists queue_announcement_created_outbox on app_private.announcements;
drop trigger if exists queue_announcement_updated_outbox on app_private.announcements;
drop trigger if exists queue_announcement_deleted_outbox on app_private.announcements;
drop trigger if exists queue_announcement_realtime_on_insert on app_private.announcements;
drop trigger if exists queue_announcement_realtime_on_update on app_private.announcements;
drop trigger if exists queue_announcement_realtime_on_delete on app_private.announcements;

drop trigger if exists queue_announcement_comment_created_outbox on app_private.announcement_comments;
drop trigger if exists queue_announcement_comment_realtime_on_insert on app_private.announcement_comments;
drop trigger if exists queue_announcement_comment_realtime_on_update on app_private.announcement_comments;
drop trigger if exists queue_announcement_comment_realtime_on_delete on app_private.announcement_comments;

drop trigger if exists queue_facility_realtime_event on app_private.facility_reports;
drop trigger if exists skip_identical_outbox_update on app_private.outbox_events;
drop trigger if exists broadcast_notification_insert on app_private.notifications;
drop trigger if exists broadcast_notification_state_change on app_private.notification_states;

create or replace function app_api.backend_delete_issue_category(category_id text, actor_uid text) returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
#variable_conflict use_column
declare
  category_record app_private.issue_categories%rowtype;
  deleted_count integer;
  target_issue record;
  op_id uuid;
  ev_id uuid;
begin
  if coalesce(btrim(actor_uid), '') = '' or coalesce(btrim(category_id), '') = '' then
    raise exception 'validation-required';
  end if;
  select * into category_record from app_private.issue_categories
    where id = backend_delete_issue_category.category_id for update;
  if not found then raise exception 'not-found'; end if;
  if category_record.is_default then raise exception 'cannot-delete-default-category'; end if;

  op_id := nullif(current_setting('novae.operation_id', true), '')::uuid;
  if op_id is null then raise exception 'missing-operation-context'; end if;

  for target_issue in
    select id, author_uid, category, title, read_access, revision from app_private.issues where category = category_record.id
  loop
    ev_id := gen_random_uuid();

    insert into app_private.domain_events(event_id, operation_id, aggregate_type, aggregate_id, event_type, actor_uid, occurred_at, payload, aggregate_version)
    values (
      ev_id, op_id, 'issue', target_issue.id::text, 'issue.deleted', backend_delete_issue_category.actor_uid, now(),
      jsonb_build_object(
        'author_uid', target_issue.author_uid,
        'issue_category', target_issue.category,
        'issue_id', target_issue.id,
        'title', target_issue.title,
        'read_access', target_issue.read_access,
        'supporter_uids', coalesce((select jsonb_agg(uid) from app_private.supports where issue_id=target_issue.id), '[]'::jsonb)
      ),
      target_issue.revision
    );

    insert into app_private.event_deliveries(event_id, destination, status)
    values (ev_id, 'notion', 'pending'), (ev_id, 'push', 'pending'), (ev_id, 'realtime', 'pending')
    on conflict do nothing;
  end loop;

  delete from app_private.notifications notification
    where notification.target_type = 'issue'
      and notification.target_id in (select id::text from app_private.issues where category = category_record.id);
  delete from app_private.issues where category = category_record.id;
  get diagnostics deleted_count = row_count;
  delete from app_private.issue_categories where id = category_record.id;

  insert into app_private.category_configuration_audit(domain, category_id, operation, actor_uid, before_value)
  values('issue', category_record.id, 'delete', backend_delete_issue_category.actor_uid, to_jsonb(category_record));
  return jsonb_build_object('success', true, 'deletedRecords', deleted_count);
end;
$$;

create or replace function app_api.backend_delete_facility_category(category_id text, actor_uid text) returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
#variable_conflict use_column
declare
  category_record app_private.facility_categories%rowtype;
  deleted_count integer;
  target_facility record;
  op_id uuid;
  ev_id uuid;
begin
  if coalesce(btrim(actor_uid), '') = '' or coalesce(btrim(category_id), '') = '' then
    raise exception 'validation-required';
  end if;
  select * into category_record from app_private.facility_categories
    where id = backend_delete_facility_category.category_id for update;
  if not found then raise exception 'not-found'; end if;
  if category_record.is_default then raise exception 'cannot-delete-default-category'; end if;

  op_id := nullif(current_setting('novae.operation_id', true), '')::uuid;
  if op_id is null then raise exception 'missing-operation-context'; end if;

  for target_facility in
    select id, author_uid, category_id, title, revision from app_private.facility_reports where category_id = category_record.id
  loop
    ev_id := gen_random_uuid();

    insert into app_private.domain_events(event_id, operation_id, aggregate_type, aggregate_id, event_type, actor_uid, occurred_at, payload, aggregate_version)
    values (
      ev_id, op_id, 'facility', target_facility.id::text, 'facility.deleted', backend_delete_facility_category.actor_uid, now(),
      jsonb_build_object('author_uid', target_facility.author_uid, 'title', target_facility.title),
      target_facility.revision
    );

    insert into app_private.event_deliveries(event_id, destination, status)
    values (ev_id, 'notion', 'pending'), (ev_id, 'push', 'pending'), (ev_id, 'realtime', 'pending')
    on conflict do nothing;
  end loop;

  delete from app_private.notifications notification
    where notification.target_type = 'facility'
      and notification.target_id in (
        select report.id::text from app_private.facility_reports report where report.category_id = category_record.id
      );
  delete from app_private.facility_reports report where report.category_id = category_record.id;
  get diagnostics deleted_count = row_count;
  delete from app_private.facility_categories where id = category_record.id;

  insert into app_private.category_configuration_audit(domain, category_id, operation, actor_uid, before_value)
  values('facility', category_record.id, 'delete', backend_delete_facility_category.actor_uid, to_jsonb(category_record));
  return jsonb_build_object('success', true, 'deletedRecords', deleted_count);
end;
$$;

drop trigger if exists admin_audit_notion_sync on app_private.admin_audit_log;
drop trigger if exists role_assignment_audit_notion_sync on app_private.role_assignment_audit;
drop trigger if exists category_configuration_audit_notion_sync on app_private.category_configuration_audit;
drop trigger if exists access_assignment_audit_notion_sync on app_private.access_assignment_audit;

-- Drop legacy tables
drop table if exists app_private.outbox_events cascade;
drop table if exists app_private.idempotency_keys cascade;
drop table if exists app_private.push_delivery_logs cascade;
drop table if exists app_private.realtime_events cascade;
drop table if exists app_private.deletion_jobs cascade;
drop table if exists app_private.platform_jobs cascade;
drop table if exists app_private.maintenance_runs cascade;

-- Remove legacy RPCs outright. The new operation/event/delivery/job model is the
-- only callable consistency surface after this migration.
drop function if exists app_private.queue_realtime_event(text, text, jsonb);
drop function if exists app_api.claim_idempotency_key(text, text, text);
drop function if exists app_api.complete_idempotency_key(text, text, text, jsonb);
drop function if exists app_api.release_idempotency_key(text, text, text);
drop function if exists app_api.complete_outbox_event(uuid);
drop function if exists app_api.fail_outbox_event(uuid, uuid);
drop function if exists app_api.complete_realtime_event(uuid);
drop function if exists app_api.complete_realtime_events(uuid[]);
drop function if exists app_api.fail_realtime_event(uuid, text);
drop function if exists app_api.fail_realtime_events(uuid[], text);
drop function if exists app_api.complete_push_delivery_job(uuid);
drop function if exists app_api.fail_push_delivery_job(uuid, uuid);
drop function if exists app_api.complete_deletion_job(uuid);
drop function if exists app_api.fail_deletion_job(uuid, uuid);

-- 11. RPC: Claim Operation
create or replace function app_api.set_operation_context(operation_id uuid)
returns void
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
begin
  if not exists(
    select 1 from app_private.operations operation
    where operation.operation_id=set_operation_context.operation_id and operation.status='processing'
  ) then raise exception 'operation-not-processing'; end if;
  perform set_config('novae.operation_id', operation_id::text, true);
end;
$$;

create or replace function app_api.claim_operation(
  operation_id uuid,
  actor_uid text,
  action_name text
)
returns table(claimed boolean, completed boolean, response jsonb)
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
#variable_conflict use_column
declare
  existing app_private.operations%rowtype;
  inserted_count integer := 0;
begin
  if claim_operation.operation_id is null or length(btrim(coalesce(claim_operation.actor_uid, ''))) = 0 or length(btrim(coalesce(claim_operation.action_name, ''))) = 0 then
    raise exception 'validation-invalid';
  end if;

  insert into app_private.operations(operation_id, actor_uid, action, status)
  values (claim_operation.operation_id, claim_operation.actor_uid, claim_operation.action_name, 'processing')
  on conflict (operation_id) do nothing;
  get diagnostics inserted_count = row_count;

  select * into existing from app_private.operations
  where operations.operation_id = claim_operation.operation_id
  for update;

  if inserted_count = 1 then
    return query select true, false, null::jsonb;
    return;
  end if;

  if existing.status = 'completed' then
    return query select false, true, existing.response;
    return;
  end if;

  if existing.status = 'processing' and existing.updated_at < now() - interval '10 minutes' then
    update app_private.operations
    set updated_at = now(),
        actor_uid = claim_operation.actor_uid,
        action = claim_operation.action_name,
        expires_at = app_private.runtime_retention_deadline('operationHours')
    where operations.operation_id = claim_operation.operation_id;
    return query select true, false, null::jsonb;
    return;
  end if;

  return query select false, false, null::jsonb;
end;
$$;

-- RPC: Complete Operation
create or replace function app_api.complete_operation(
  operation_id uuid,
  action_response jsonb
)
returns void
language sql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  update app_private.operations
  set status = 'completed',
      response = complete_operation.action_response,
      updated_at = now(),
      expires_at = app_private.runtime_retention_deadline('operationHours')
  where operations.operation_id = complete_operation.operation_id
    and status = 'processing';
$$;

-- RPC: Fail Operation
create or replace function app_api.fail_operation(
  operation_id uuid,
  error_detail jsonb
)
returns void
language sql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  update app_private.operations
  set status = 'failed',
      error_detail = fail_operation.error_detail,
      updated_at = now()
  where operations.operation_id = fail_operation.operation_id
    and status = 'processing';
$$;

-- RPC: Record Domain Event (atomic event and delivery creation)
create table app_private.domain_event_types (
  event_type text primary key
);

insert into app_private.domain_event_types(event_type) values
  ('issue.created'), ('issue.status_changed'), ('issue.result_updated'), ('issue.deleted'),
  ('support.goal_met'), ('support.toggled'), ('issue.comment_created'), ('issue.comment_deleted'),
  ('facility.created'), ('facility.status_changed'), ('facility.deleted'), ('facility.affected_toggled'),
  ('announcement.created'), ('announcement.updated'), ('announcement.deleted'), ('announcement.liked'),
  ('announcement.comment_created'), ('announcement.comment_deleted'), ('admin.audit_recorded'),
  ('category.managed'), ('category.updated'), ('platform.settings_updated'), ('system.setup_completed'),
  ('system.features_updated'), ('user.restricted'), ('user.role_changed'), ('user.access_scoped'),
  ('user.avatar_updated'), ('notification.marked_opened'), ('push_token.updated'), ('upload.mutated'),
  ('deletion_job.retried');

alter table app_private.domain_events
  add constraint domain_events_event_type_fkey
  foreign key (event_type) references app_private.domain_event_types(event_type);

create table app_private.event_destinations (
  destination text primary key
);

insert into app_private.event_destinations(destination) values
  ('notion'), ('in_app'), ('push'), ('realtime');

create or replace function app_private.protect_consistency_identity()
returns trigger
language plpgsql
as $$
declare
  old_row jsonb := to_jsonb(old);
  new_row jsonb := to_jsonb(new);
begin
  if tg_table_name = 'domain_events' then
    raise exception 'immutable-domain-event';
  elsif tg_table_name = 'operations' and (
    new_row->'operation_id' is distinct from old_row->'operation_id'
    or new_row->'actor_uid' is distinct from old_row->'actor_uid'
    or new_row->'action' is distinct from old_row->'action'
    or new_row->'created_at' is distinct from old_row->'created_at'
  ) then raise exception 'immutable-operation-identity';
  elsif tg_table_name = 'event_deliveries' and (
    new_row->'id' is distinct from old_row->'id'
    or new_row->'event_id' is distinct from old_row->'event_id'
    or new_row->'destination' is distinct from old_row->'destination'
    or new_row->'created_at' is distinct from old_row->'created_at'
  ) then raise exception 'immutable-delivery-identity';
  elsif tg_table_name = 'background_jobs' and (
    new_row->'id' is distinct from old_row->'id'
    or new_row->'job_type' is distinct from old_row->'job_type'
    or new_row->'scope_id' is distinct from old_row->'scope_id'
    or new_row->'payload' is distinct from old_row->'payload'
    or new_row->'created_at' is distinct from old_row->'created_at'
  ) then raise exception 'immutable-job-identity';
  end if;
  return new;
end;
$$;

create trigger protect_domain_event before update on app_private.domain_events
for each row execute function app_private.protect_consistency_identity();
create trigger protect_operation_identity before update on app_private.operations
for each row execute function app_private.protect_consistency_identity();
create trigger protect_delivery_identity before update on app_private.event_deliveries
for each row execute function app_private.protect_consistency_identity();
create trigger protect_job_identity before update on app_private.background_jobs
for each row execute function app_private.protect_consistency_identity();

create or replace function app_api.record_domain_event(
  operation_id uuid,
  aggregate_type text,
  aggregate_id text,
  event_type text,
  actor_uid text,
  payload jsonb default '{}'::jsonb,
  destinations text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  new_event_id uuid := gen_random_uuid();
  dest text;
  current_version integer := 1;
begin
  if not exists(select 1 from app_private.domain_event_types registry where registry.event_type = record_domain_event.event_type) then
    raise exception 'invalid-event-type: %', event_type;
  end if;

  if destinations is not null then
    foreach dest in array destinations loop
      if not exists(select 1 from app_private.event_destinations registry where registry.destination = dest) then
        raise exception 'invalid-destination: %', dest;
      end if;
    end loop;
  end if;

  -- Determine current version of aggregate if applicable
  if aggregate_type = 'issue' then
    select coalesce(revision, 1) into current_version from app_private.issues where id::text = aggregate_id;
  elsif aggregate_type = 'facility' then
    select coalesce(revision, 1) into current_version from app_private.facility_reports where id::text = aggregate_id;
  elsif aggregate_type = 'announcement' then
    select coalesce(revision, 1) into current_version from app_private.announcements where id::text = aggregate_id;
  end if;

  insert into app_private.domain_events(
    event_id, operation_id, aggregate_type, aggregate_id,
    event_type, actor_uid, occurred_at, payload, aggregate_version
  ) values (
    new_event_id, record_domain_event.operation_id, record_domain_event.aggregate_type, record_domain_event.aggregate_id,
    record_domain_event.event_type, record_domain_event.actor_uid, now(), coalesce(record_domain_event.payload, '{}'::jsonb), coalesce(current_version, 1)
  );

  if destinations is not null then
    foreach dest in array destinations loop
      insert into app_private.event_deliveries(event_id, destination, status)
      values (new_event_id, dest, 'pending')
      on conflict do nothing;
    end loop;
  end if;

  return new_event_id;
end;
$$;

-- RPC: Claim Event Deliveries
create or replace function app_api.claim_event_deliveries(
  target_destination text,
  batch_size integer default 25
)
returns table(
  delivery_id uuid,
  event_id uuid,
  operation_id uuid,
  destination text,
  attempt_count integer,
  event_type text,
  aggregate_type text,
  aggregate_id text,
  actor_uid text,
  occurred_at timestamptz,
  payload jsonb,
  aggregate_version integer
)
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
#variable_conflict use_column
declare
  claimed_ids uuid[];
begin
  select array_agg(d.id) into claimed_ids
  from (
    select id from app_private.event_deliveries
    where event_deliveries.destination = claim_event_deliveries.target_destination
      and (
        (status in ('pending', 'failed') and next_attempt_at <= now())
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
      and attempt_count < 8
    order by next_attempt_at asc, created_at asc
    limit least(greatest(coalesce(claim_event_deliveries.batch_size, 25), 1), 100)
    for update skip locked
  ) d;

  if claimed_ids is null or array_length(claimed_ids, 1) is null then
    return;
  end if;

  update app_private.event_deliveries
  set status = 'processing',
      attempt_count = attempt_count + 1,
      locked_at = now(),
      updated_at = now()
  where id = any(claimed_ids);

  return query
  select
    d.id as delivery_id,
    e.event_id,
    e.operation_id,
    d.destination,
    d.attempt_count,
    e.event_type,
    e.aggregate_type,
    e.aggregate_id,
    e.actor_uid,
    e.occurred_at,
    e.payload,
    e.aggregate_version
  from app_private.event_deliveries d
  join app_private.domain_events e on e.event_id = d.event_id
  where d.id = any(claimed_ids)
  order by d.created_at asc;
end;
$$;

-- RPC: Complete Event Delivery
create or replace function app_api.complete_event_delivery(
  delivery_id uuid,
  attempt_id uuid
)
returns void
language sql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  update app_private.event_deliveries
  set status = 'completed',
      last_attempt_id = complete_event_delivery.attempt_id,
      completed_at = now(),
      locked_at = null,
      updated_at = now(),
      expires_at = app_private.runtime_retention_deadline('deliveryCompletedDays')
  where id = complete_event_delivery.delivery_id;
$$;

-- RPC: Fail Event Delivery
create or replace function app_api.fail_event_delivery(
  delivery_id uuid,
  attempt_id uuid,
  error_info jsonb
)
returns void
language sql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  update app_private.event_deliveries
  set status = 'failed',
      last_attempt_id = fail_event_delivery.attempt_id,
      error_detail = fail_event_delivery.error_info,
      next_attempt_at = now() + make_interval(mins => least(60, greatest(1, attempt_count * 2))),
      locked_at = null,
      updated_at = now(),
      expires_at = app_private.runtime_retention_deadline('deliveryFailedDays')
  where id = fail_event_delivery.delivery_id;
$$;

-- RPC: Claim Background Jobs
create or replace function app_api.claim_background_jobs(
  requested_batch_size integer default 25
)
returns table(
  id uuid,
  job_type text,
  scope_id text,
  payload jsonb,
  status text,
  estimated_rows bigint,
  processed_rows bigint,
  affected_rows bigint,
  batch_size integer,
  attempt_count integer,
  last_attempt_id uuid,
  next_attempt_at timestamptz,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  error_detail jsonb,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  effective_limit integer := least(greatest(coalesce(claim_background_jobs.requested_batch_size, 25), 1), 100);
begin
  return query
  with claimed as (
    select candidate.id from app_private.background_jobs candidate
    where candidate.attempt_count < 8
      and (
        (candidate.status in ('pending', 'failed') and candidate.next_attempt_at <= now())
        or (candidate.status = 'processing' and candidate.locked_at < now() - interval '10 minutes')
      )
    order by candidate.next_attempt_at asc, candidate.created_at asc
    limit effective_limit
    for update skip locked
  ), updated as (
    update app_private.background_jobs job
    set status = 'processing',
        attempt_count = job.attempt_count + 1,
        locked_at = now(),
        started_at = coalesce(job.started_at, now()),
        updated_at = now()
    from claimed
    where job.id = claimed.id
    returning job.*
  )
  select
    updated.id,
    updated.job_type,
    updated.scope_id,
    updated.payload,
    updated.status,
    updated.estimated_rows,
    updated.processed_rows,
    updated.affected_rows,
    updated.batch_size,
    updated.attempt_count,
    updated.last_attempt_id,
    updated.next_attempt_at,
    updated.locked_at,
    updated.started_at,
    updated.completed_at,
    updated.result,
    updated.error_detail,
    updated.created_by,
    updated.created_at,
    updated.updated_at,
    updated.expires_at
  from updated;
end;
$$;

-- RPC: Complete Background Job
create or replace function app_api.complete_background_job(
  job_id uuid,
  attempt_id uuid,
  job_result jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  update app_private.background_jobs
  set status = 'completed',
      last_attempt_id = complete_background_job.attempt_id,
      completed_at = now(),
      result = coalesce(job_result, '{}'::jsonb),
      locked_at = null,
      updated_at = now(),
      expires_at = app_private.runtime_retention_deadline('backgroundJobCompletedDays')
  where id = complete_background_job.job_id;
$$;

-- RPC: Fail Background Job
create or replace function app_api.fail_background_job(
  job_id uuid,
  attempt_id uuid,
  error_info jsonb
)
returns void
language sql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  update app_private.background_jobs
  set status = 'failed',
      last_attempt_id = fail_background_job.attempt_id,
      error_detail = fail_background_job.error_info,
      next_attempt_at = now() + make_interval(mins => least(60, greatest(1, attempt_count * 2))),
      locked_at = null,
      updated_at = now(),
      expires_at = app_private.runtime_retention_deadline('backgroundJobFailedDays')
  where id = fail_background_job.job_id;
$$;

-- RPC: Enqueue Background Job
create or replace function app_api.enqueue_background_job(
  job_type text,
  scope_id text,
  payload jsonb default '{}'::jsonb,
  created_by text default 'system'
)
returns uuid
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  new_job_id uuid := gen_random_uuid();
begin
  insert into app_private.background_jobs(
    id, job_type, scope_id, payload, created_by
  ) values (
    new_job_id, job_type, coalesce(scope_id, 'global'), coalesce(payload, '{}'::jsonb), coalesce(created_by, 'system')
  );
  return new_job_id;
end;
$$;

-- 12. Update Policy Job & Settings Functions to use background_jobs
create or replace function app_private.enqueue_policy_job(
  job_type text,
  scope_id text,
  payload jsonb,
  actor_uid text
)
returns uuid
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  estimate bigint := 0;
  next_id uuid;
  next_status text;
  canonical_job_type text := case when job_type = 'retention-cleanup' then 'retention_cleanup' else 'category_policy' end;
  canonical_payload jsonb := coalesce(payload, '{}'::jsonb) || jsonb_build_object('policyType', job_type);
begin
  estimate := app_private.policy_job_estimate(job_type, scope_id, payload);

  update app_private.background_jobs
  set status = 'superseded',
      completed_at = now(),
      updated_at = now(),
      locked_at = null,
      result = jsonb_build_object('reason', 'replaced-by-newer-policy')
  where background_jobs.job_type = canonical_job_type
    and background_jobs.scope_id = enqueue_policy_job.scope_id
    and background_jobs.payload->>'policyType' = enqueue_policy_job.job_type
    and status in ('pending', 'processing');

  next_status := case when estimate = 0 then 'completed' else 'pending' end;
  insert into app_private.background_jobs(
    job_type, scope_id, payload, status, estimated_rows, created_by, completed_at, result
  ) values (
    canonical_job_type,
    scope_id,
    canonical_payload,
    next_status,
    estimate,
    coalesce(nullif(actor_uid, ''), 'system'),
    case when estimate = 0 then now() else null end,
    case when estimate = 0 then jsonb_build_object('affectedRows', 0) else '{}'::jsonb end
  ) returning id into next_id;

  return next_id;
end;
$$;

create or replace function app_api.backend_list_platform_jobs(
  actor_uid text,
  page_limit integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  limited integer := least(greatest(coalesce(page_limit, 20), 1), 50);
begin
  if not app_private.actor_has_permission(actor_uid, 'category.manage') then
    raise exception 'permission-denied';
  end if;

  return jsonb_build_object('entries', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', id,
      'jobType', coalesce(payload->>'policyType', job_type),
      'engineType', job_type,
      'scopeId', scope_id,
      'status', status,
      'estimatedRows', estimated_rows,
      'processedRows', processed_rows,
      'affectedRows', affected_rows,
      'failureId', last_attempt_id,
      'createdAt', created_at,
      'updatedAt', updated_at,
      'startedAt', started_at,
      'completedAt', completed_at,
      'result', result
    ) order by created_at desc)
    from (
      select * from app_private.background_jobs
      where job_type in ('retention_cleanup', 'category_policy')
      order by created_at desc
      limit limited
    ) jobs
  ), '[]'::jsonb));
end;
$$;

create or replace function app_api.backend_process_platform_job_batch(
  batch_size integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  limited integer := least(greatest(coalesce(batch_size, 100), 1), 500);
  target_job app_private.background_jobs%rowtype;
  batch_result jsonb;
  next_affected integer;
  has_more boolean;
begin
  select * into target_job
  from app_private.background_jobs
  where job_type in ('retention_cleanup', 'category_policy')
    and status in ('pending', 'processing')
  order by created_at asc
  limit 1
  for update skip locked;

  if target_job.id is null then
    return jsonb_build_object('hasMore', false, 'processed', 0);
  end if;

  if target_job.status = 'pending' then
    update app_private.background_jobs
    set status = 'processing', started_at = coalesce(started_at, now()), updated_at = now()
    where id = target_job.id;
  end if;

  if target_job.job_type = 'retention_cleanup' then
    batch_result := app_private.run_retention_cleanup_batch(target_job.payload, limited);
    next_affected := coalesce((batch_result ->> 'affectedRows')::integer, 0);
    has_more := coalesce((batch_result ->> 'hasMore')::boolean, false);
  elsif target_job.payload->>'policyType' = 'announcement-comments' then
    declare
      desired boolean := coalesce((target_job.payload->>'enabled')::boolean, false);
    begin
      with targets as (
        select id from app_private.announcements
        where comments_enabled is distinct from desired
        order by id limit limited
      ), changed as (
        update app_private.announcements
        set comments_enabled = desired
        where id in (select id from targets)
        returning 1
      ) select count(*) into next_affected from changed;
      has_more := next_affected = limited;
      batch_result := jsonb_build_object('affectedRows', next_affected, 'hasMore', has_more);
    end;
  elsif target_job.payload->>'policyType' = 'issue-category-comments' then
    declare
      desired boolean := coalesce((target_job.payload->>'enabled')::boolean, false);
    begin
      with targets as (
        select id from app_private.issues
        where category = target_job.scope_id
          and comments_enabled is distinct from (desired and status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected'))
        order by id limit limited
      ), changed as (
        update app_private.issues
        set comments_enabled = (desired and status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected'))
        where id in (select id from targets)
        returning 1
      ) select count(*) into next_affected from changed;
      has_more := next_affected = limited;
      batch_result := jsonb_build_object('affectedRows', next_affected, 'hasMore', has_more);
    end;
  else
    batch_result := app_private.run_category_policy_batch(target_job.scope_id, target_job.payload, limited);
    next_affected := coalesce((batch_result ->> 'affectedRows')::integer, 0);
    has_more := coalesce((batch_result ->> 'hasMore')::boolean, false);
  end if;

  update app_private.background_jobs
  set affected_rows = affected_rows + next_affected,
      processed_rows = processed_rows + limited,
      status = case when has_more then 'processing' else 'completed' end,
      completed_at = case when has_more then null else now() end,
      result = case when has_more then result else batch_result end,
      updated_at = now()
  where id = target_job.id;

  return jsonb_build_object(
    'jobId', target_job.id,
    'hasMore', has_more,
    'affectedRows', next_affected,
    'details', batch_result -> 'details'
  );
end;
$$;

create or replace function app_api.backend_save_platform_settings(
  actor_uid text,
  image_settings jsonb,
  retention_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  job_id uuid;
  estimate bigint;
begin
  if not app_private.actor_has_permission(actor_uid, 'category.manage') then
    raise exception 'permission-denied';
  end if;
  perform app_private.assert_retention_config(retention_config);
  insert into app_private.runtime_settings(key, value, updated_at) values
    ('image_upload_settings', image_settings::text, now()),
    ('data_retention_settings', retention_config::text, now())
  on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at;

  job_id := app_private.enqueue_policy_job('retention-cleanup', 'global', retention_config, actor_uid);
  select estimated_rows into estimate from app_private.background_jobs where id = job_id;
  insert into app_private.category_configuration_audit(domain, operation, actor_uid, before_value, after_value)
  values ('platform', 'update-retention', actor_uid, null, retention_config);
  return jsonb_build_object('jobId', job_id, 'estimatedRows', estimate);
end;
$$;

create or replace function app_api.run_scheduled_maintenance_cleanup()
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  job_id uuid;
  retention_config jsonb := app_private.runtime_retention_config();
begin
  select id into job_id from app_private.background_jobs
  where job_type = 'retention_cleanup' and scope_id = 'global' and status in ('pending', 'processing')
  order by created_at desc limit 1;

  if job_id is null then
    job_id := app_private.enqueue_policy_job('retention-cleanup', 'global', retention_config, 'system');
  end if;

  return jsonb_build_object(
    'result', jsonb_build_object('jobId', job_id),
    'dueWorkers', jsonb_build_object(
      'deliveries', exists(select 1 from app_private.event_deliveries d where d.attempt_count < 8 and ((d.status in ('pending', 'failed') and d.next_attempt_at <= now()) or (d.status = 'processing' and d.locked_at < now() - interval '10 minutes'))),
      'jobs', exists(select 1 from app_private.background_jobs j where j.attempt_count < 8 and ((j.status in ('pending', 'failed') and j.next_attempt_at <= now()) or (j.status = 'processing' and j.locked_at < now() - interval '10 minutes')))
    )
  );
end;
$$;

-- 13. Update Retention Core Batch & Estimate
create or replace function app_private.retention_cleanup_estimate(retention_config jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'public'
as $$
declare
  details jsonb;
  total bigint;
  closed_issue_days integer := app_private.retention_integer(retention_config, 'closedIssuesDays');
  closed_facility_days integer := app_private.retention_integer(retention_config, 'closedFacilitiesDays');
  announcement_days integer := app_private.retention_integer(retention_config, 'announcementsDays');
  notifications_days integer := app_private.retention_integer(retention_config, 'notificationsDays');
  inactive_push_days integer := app_private.retention_integer(retention_config, 'inactivePushTokensDays');
  inactive_avatar_days integer := app_private.retention_integer(retention_config, 'inactiveAvatarsDays');
  inactive_pii_days integer := app_private.retention_integer(retention_config, 'inactiveProfilePiiDays');
  restriction_days integer := app_private.retention_integer(retention_config, 'expiredRestrictionsDays');
  role_audit_days integer := app_private.retention_integer(retention_config, 'roleAssignmentAuditDays');
  admin_audit_days integer := app_private.retention_integer(retention_config, 'adminAuditDays');
  category_audit_days integer := app_private.retention_integer(retention_config, 'categoryConfigurationAuditDays');
  access_audit_days integer := app_private.retention_integer(retention_config, 'accessAssignmentAuditDays');
  pending_upload_hours integer := app_private.retention_integer(retention_config, 'pendingUploadHours');
  unattached_upload_hours integer := app_private.retention_integer(retention_config, 'unattachedUploadHours');
  failed_upload_hours integer := app_private.retention_integer(retention_config, 'failedUploadHours');
begin
  perform app_private.assert_retention_config(retention_config);

  select jsonb_build_object(
    'closedIssues', (select count(*) from app_private.issues where app_private.retention_boolean(retention_config, 'closedIssuesEnabled') and status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed') and closed_at < now() - make_interval(days => closed_issue_days)),
    'closedFacilities', (select count(*) from app_private.facility_reports where app_private.retention_boolean(retention_config, 'closedFacilitiesEnabled') and status in ('completed', 'unable-to-handle') and closed_at < now() - make_interval(days => closed_facility_days)),
    'announcements', (select count(*) from app_private.announcements where app_private.retention_boolean(retention_config, 'announcementsEnabled') and published_at < now() - make_interval(days => announcement_days)),
    'uploads', (select count(*) from app_private.uploads where cloudinary_public_id is not null and ((status = 'pending' and created_at < now() - make_interval(hours => pending_upload_hours)) or (status = 'ready' and attached_target_id is null and updated_at < now() - make_interval(hours => unattached_upload_hours)) or (status = 'failed' and updated_at < now() - make_interval(hours => failed_upload_hours)))),
    'inactiveAvatars', (select count(*) from app_private.user_profiles profile where app_private.retention_boolean(retention_config, 'inactiveAvatarsEnabled') and avatar_public_id is not null and coalesce(last_seen_at, created_at) < now() - make_interval(days => inactive_avatar_days) and not exists(select 1 from app_private.issues where author_uid = profile.uid) and not exists(select 1 from app_private.comments where author_uid = profile.uid) and not exists(select 1 from app_private.facility_reports where author_uid = profile.uid) and not exists(select 1 from app_private.announcements where author_uid = profile.uid) and not exists(select 1 from app_private.announcement_comments where author_uid = profile.uid)),
    'inactiveProfilePii', (select count(*) from app_private.user_profiles profile where app_private.retention_boolean(retention_config, 'inactiveProfilePiiEnabled') and coalesce(last_seen_at, created_at) < now() - make_interval(days => inactive_pii_days) and not exists(select 1 from app_private.user_role_assignments where uid = profile.uid) and not exists(select 1 from app_private.user_issue_category_assignments where uid = profile.uid) and not exists(select 1 from app_private.user_facility_category_assignments where uid = profile.uid) and (email is not null or (display_name is not null and not exists(select 1 from app_private.issues where author_uid = profile.uid) and not exists(select 1 from app_private.comments where author_uid = profile.uid) and not exists(select 1 from app_private.facility_reports where author_uid = profile.uid) and not exists(select 1 from app_private.announcements where author_uid = profile.uid) and not exists(select 1 from app_private.announcement_comments where author_uid = profile.uid)))),
    'restrictions', (select count(*) from app_private.user_restrictions where app_private.retention_boolean(retention_config, 'expiredRestrictionsEnabled') and not restricted_permanently and restricted_until < now() - make_interval(days => restriction_days)),
    'notifications', (select count(*) from app_private.notifications where expires_at is distinct from case when app_private.retention_boolean(retention_config, 'notificationsEnabled') then created_at + make_interval(days => notifications_days) else 'infinity'::timestamptz end or (app_private.retention_boolean(retention_config, 'notificationsEnabled') and created_at + make_interval(days => notifications_days) < now())),
    'operations', (
      select count(*) from app_private.operations operation
      where operation.expires_at < now()
        and not exists(select 1 from app_private.domain_events event where event.operation_id=operation.operation_id)
        and not exists(select 1 from app_private.admin_audit_log audit where audit.operation_id=operation.operation_id)
    ),
    'eventDeliveries', (select count(*) from app_private.event_deliveries where (status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes') or (status in ('completed', 'failed') and expires_at < now())),
    'pushTokens', (select count(*) from app_private.push_tokens where permission <> 'granted' or last_confirmed_at < now() - make_interval(days => inactive_push_days)),
    'backgroundJobs', (select count(*) from app_private.background_jobs where (status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes') or (status in ('completed', 'failed', 'superseded') and expires_at < now())),
    'auditLogs', (select (select count(*) from app_private.role_assignment_audit where created_at < now() - make_interval(days => role_audit_days)) + (select count(*) from app_private.admin_audit_log where created_at < now() - make_interval(days => admin_audit_days)) + (select count(*) from app_private.category_configuration_audit where created_at < now() - make_interval(days => category_audit_days)) + (select count(*) from app_private.access_assignment_audit where created_at < now() - make_interval(days => access_audit_days))),
    'notionMappings', (select count(*) from app_private.notion_pages page where (target_type = 'announcement' and not exists(select 1 from app_private.announcements where id::text = page.target_id)) or (target_type = 'admin-audit' and not exists(select 1 from app_private.admin_audit_log where id::text = page.target_id)) or (target_type = 'issue' and not exists(select 1 from app_private.issues where id::text = page.target_id)) or (target_type = 'facility' and not exists(select 1 from app_private.facility_reports where id::text = page.target_id)))
  ) into details;

  select coalesce(sum(value::text::bigint), 0) into total from jsonb_each(details);
  return jsonb_build_object('details', details, 'totalEstimatedRows', total);
end;
$$;

drop function if exists app_private.run_retention_cleanup_core_batch(jsonb, integer);
create or replace function app_private.run_retention_cleanup_core_batch(
  retention_config jsonb,
  limited integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  changed integer := 0;
  total_changed integer := 0;
  has_more boolean := false;
  details jsonb := '{}'::jsonb;
  cleanup_operation_id uuid := gen_random_uuid();
  closed_issue_days integer := app_private.retention_integer(retention_config, 'closedIssuesDays');
  closed_facility_days integer := app_private.retention_integer(retention_config, 'closedFacilitiesDays');
  announcement_days integer := app_private.retention_integer(retention_config, 'announcementsDays');
  notifications_days integer := app_private.retention_integer(retention_config, 'notificationsDays');
  inactive_push_days integer := app_private.retention_integer(retention_config, 'inactivePushTokensDays');
  inactive_avatar_days integer := app_private.retention_integer(retention_config, 'inactiveAvatarsDays');
  restriction_days integer := app_private.retention_integer(retention_config, 'expiredRestrictionsDays');
  category_audit_days integer := app_private.retention_integer(retention_config, 'categoryConfigurationAuditDays');
  access_audit_days integer := app_private.retention_integer(retention_config, 'accessAssignmentAuditDays');
  pending_upload_hours integer := app_private.retention_integer(retention_config, 'pendingUploadHours');
  unattached_upload_hours integer := app_private.retention_integer(retention_config, 'unattachedUploadHours');
  failed_upload_hours integer := app_private.retention_integer(retention_config, 'failedUploadHours');
begin
  insert into app_private.operations(operation_id, actor_uid, action, status, response)
  values (
    cleanup_operation_id,
    'system',
    'retentionCleanup',
    'completed',
    jsonb_build_object('source', 'background_job')
  );

  -- 1. Operations cleanup
  with targets as (
    select operation_id from app_private.operations
    where expires_at < now()
      and not exists (
        select 1 from app_private.domain_events event
        where event.operation_id = operations.operation_id
      )
      and not exists (
        select 1 from app_private.admin_audit_log audit
        where audit.operation_id = operations.operation_id
      )
    order by operation_id limit limited
  ), deleted as (
    delete from app_private.operations where operation_id in (select operation_id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('operations', changed);

  -- 2. Event deliveries cleanup
  with targets as (
    select id from app_private.event_deliveries
    where (status in ('completed', 'failed') and expires_at < now())
       or (status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes')
    order by id limit limited
  ), deleted as (
    delete from app_private.event_deliveries where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('eventDeliveries', changed);

  -- 3. Background jobs cleanup
  with targets as (
    select id from app_private.background_jobs
    where (status in ('completed', 'failed', 'superseded') and expires_at < now())
       or (status = 'processing' and attempt_count >= 8 and locked_at < now() - interval '15 minutes')
    order by id limit limited
  ), deleted as (
    delete from app_private.background_jobs where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('backgroundJobs', changed);

  -- 4. Expired restrictions
  if app_private.retention_boolean(retention_config, 'expiredRestrictionsEnabled') then
    with targets as (
      select uid from app_private.user_restrictions
      where not restricted_permanently and restricted_until < now() - make_interval(days => restriction_days)
      order by uid limit limited
    ), deleted as (
      delete from app_private.user_restrictions where uid in (select uid from targets) returning 1
    ) select count(*) into changed from deleted;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('restrictions', changed);
  end if;

  -- 5. Inactive push tokens
  with targets as (
    select uid, device_id from app_private.push_tokens
    where permission <> 'granted' or last_confirmed_at < now() - make_interval(days => inactive_push_days)
    order by uid, device_id limit limited
  ), deleted as (
    delete from app_private.push_tokens pt
    using targets
    where pt.uid = targets.uid and pt.device_id = targets.device_id
    returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('pushTokens', changed);

  -- 6. Expired notifications
  if app_private.retention_boolean(retention_config, 'notificationsEnabled') then
    with targets as (
      select id from app_private.notifications
      where expires_at is distinct from created_at + make_interval(days => notifications_days)
      order by id limit limited
    ), updated_notifications as (
      update app_private.notifications
      set expires_at = created_at + make_interval(days => notifications_days)
      where id in (select id from targets)
      returning 1
    ) select count(*) into changed from updated_notifications;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
  else
    with targets as (
      select id from app_private.notifications
      where expires_at is distinct from 'infinity'::timestamptz
      order by id limit limited
    ), retained_notifications as (
      update app_private.notifications
      set expires_at = 'infinity'::timestamptz
      where id in (select id from targets)
      returning 1
    ) select count(*) into changed from retained_notifications;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
  end if;

  with targets as (
    select id from app_private.notifications
    where expires_at < now()
    order by id limit limited
  ), deleted as (
    delete from app_private.notifications where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('notifications', changed);

  -- 7. Closed issues
  if app_private.retention_boolean(retention_config, 'closedIssuesEnabled') then
    with targets as (
      select id, author_uid, category, title from app_private.issues
      where status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed')
        and closed_at < now() - make_interval(days => closed_issue_days)
      order by id limit limited
    ), queued_events as (
      insert into app_private.domain_events(event_id, event_type, aggregate_type, aggregate_id, actor_uid, payload, operation_id)
      select
        gen_random_uuid(),
        'issue.deleted',
        'issue',
        target.id::text,
        target.author_uid,
        jsonb_build_object(
          'author_uid', target.author_uid,
          'issue_category', target.category,
          'issue_id', target.id,
          'retention_cleanup', true,
          'title', target.title
        ),
        cleanup_operation_id
      from targets target
      where exists(select 1 from app_private.notion_pages where target_type = 'issue' and target_id = target.id::text)
      returning event_id
    ), queued_deliveries as (
      insert into app_private.event_deliveries(event_id, destination)
      select event_id, 'notion' from queued_events
      returning 1
    ), deleted as (
      delete from app_private.issues where id in (select id from targets) returning 1
    ) select count(*) into changed from deleted;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('closedIssues', changed);
  end if;

  -- 8. Closed facilities
  if app_private.retention_boolean(retention_config, 'closedFacilitiesEnabled') then
    with targets as (
      select id, author_uid, title from app_private.facility_reports
      where status in ('completed', 'unable-to-handle')
        and closed_at < now() - make_interval(days => closed_facility_days)
      order by id limit limited
    ), queued_events as (
      insert into app_private.domain_events(event_id, event_type, aggregate_type, aggregate_id, actor_uid, payload, operation_id)
      select
        gen_random_uuid(),
        'facility.deleted',
        'facility',
        target.id::text,
        target.author_uid,
        jsonb_build_object(
          'author_uid', target.author_uid,
          'retention_cleanup', true,
          'title', target.title
        ),
        cleanup_operation_id
      from targets target
      where exists(select 1 from app_private.notion_pages where target_type = 'facility' and target_id = target.id::text)
      returning event_id
    ), queued_deliveries as (
      insert into app_private.event_deliveries(event_id, destination)
      select event_id, 'notion' from queued_events
      returning 1
    ), deleted as (
      delete from app_private.facility_reports where id in (select id from targets) returning 1
    ) select count(*) into changed from deleted;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('closedFacilities', changed);
  end if;

  -- 9. Announcements
  if app_private.retention_boolean(retention_config, 'announcementsEnabled') then
    with targets as (
      select id from app_private.announcements
      where published_at < now() - make_interval(days => announcement_days)
      order by id limit limited
    ), deleted as (
      delete from app_private.announcements where id in (select id from targets) returning 1
    ) select count(*) into changed from deleted;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('announcements', changed);
  end if;

  -- 10. Uploads
  with targets as (
    select id, cloudinary_public_id from app_private.uploads
    where cloudinary_public_id is not null
      and (
        (status = 'pending' and created_at < now() - make_interval(hours => pending_upload_hours))
        or (status = 'ready' and attached_target_id is null and updated_at < now() - make_interval(hours => unattached_upload_hours))
        or (status = 'failed' and updated_at < now() - make_interval(hours => failed_upload_hours))
      )
    order by id limit limited
  ), queued as (
    insert into app_private.background_jobs(job_type, scope_id, payload, created_by)
    select 'deletion', id::text, jsonb_build_object('target_type', 'upload', 'target_id', id::text, 'cloudinary_public_id', cloudinary_public_id), 'retention_cleanup'
    from targets
    returning 1
  ), deleted as (
    delete from app_private.uploads where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('uploads', changed);

  -- 11. Inactive avatars
  if app_private.retention_boolean(retention_config, 'inactiveAvatarsEnabled') then
    with targets as (
      select profile.uid, profile.avatar_public_id
      from app_private.user_profiles profile
      where avatar_public_id is not null
        and coalesce(last_seen_at, created_at) < now() - make_interval(days => inactive_avatar_days)
        and not exists(select 1 from app_private.issues where author_uid = profile.uid)
        and not exists(select 1 from app_private.comments where author_uid = profile.uid)
        and not exists(select 1 from app_private.facility_reports where author_uid = profile.uid)
        and not exists(select 1 from app_private.announcements where author_uid = profile.uid)
        and not exists(select 1 from app_private.announcement_comments where author_uid = profile.uid)
      order by uid limit limited
    ), cleared as (
      update app_private.user_profiles profile
      set avatar_hash = null,
          avatar_public_id = null,
          avatar_source_url = null,
          avatar_checked_at = null,
          cached_photo_url = null,
          photo_url = null,
          avatar_version = profile.avatar_version + 1,
          profile_version = profile.profile_version + 1,
          updated_at = now()
      from targets
      where profile.uid = targets.uid
      returning profile.uid, targets.avatar_public_id
    ), queued as (
      insert into app_private.background_jobs(job_type, scope_id, payload, created_by)
      select 'deletion', uid, jsonb_build_object('target_type', 'avatar', 'target_id', uid, 'cloudinary_public_id', avatar_public_id), 'retention_cleanup'
      from cleared
      returning 1
    ) select count(*) into changed from cleared;
    total_changed := total_changed + changed;
    has_more := has_more or changed = limited;
    details := details || jsonb_build_object('inactiveAvatars', changed);
  end if;

  -- 12. Notion mappings
  with targets as (
    select target_type, target_id
    from app_private.notion_pages page
    where (target_type = 'announcement' and not exists(select 1 from app_private.announcements where id::text = page.target_id))
       or (target_type = 'admin-audit' and not exists(select 1 from app_private.admin_audit_log where id::text = page.target_id))
       or (target_type = 'issue' and not exists(select 1 from app_private.issues where id::text = page.target_id))
       or (target_type = 'facility' and not exists(select 1 from app_private.facility_reports where id::text = page.target_id))
    order by target_type, target_id limit limited
  ), deleted as (
    delete from app_private.notion_pages page
    using targets
    where page.target_type = targets.target_type and page.target_id = targets.target_id
    returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  -- 13. Category configuration audit
  with targets as (
    select id from app_private.category_configuration_audit
    where created_at < now() - make_interval(days => category_audit_days)
    order by id limit limited
  ), deleted as (
    delete from app_private.category_configuration_audit where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('categoryConfigurationAudit', changed);

  -- 14. Access assignment audit
  with targets as (
    select id from app_private.access_assignment_audit
    where created_at < now() - make_interval(days => access_audit_days)
    order by id limit limited
  ), deleted as (
    delete from app_private.access_assignment_audit where id in (select id from targets) returning 1
  ) select count(*) into changed from deleted;
  total_changed := total_changed + changed;
  has_more := has_more or changed = limited;
  details := details || jsonb_build_object('accessAssignmentAudit', changed);

  return jsonb_build_object('affectedRows', total_changed, 'hasMore', has_more, 'details', details);
end;
$$;

-- 14. Dashboard snapshot update (reads operations, event_deliveries, background_jobs)
create or replace function app_api.get_platform_dashboard_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  counters record;
  category_counters record;
  activity record;
  delivery_counts record;
  job_counts record;
  maintenance record;
  recent_failures record;
begin
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) value
  into counters
  from app_private.platform_counters;

  select
    coalesce(jsonb_object_agg(category, issues), '{}'::jsonb) issues,
    coalesce(jsonb_object_agg(category, comments), '{}'::jsonb) comments
  into category_counters
  from app_private.platform_category_counters;

  select coalesce((select value::timestamptz from app_private.runtime_settings where key = 'last_activity_at'), 'epoch'::timestamptz) value
  into activity;

  select
    count(*) filter (where status = 'failed')::bigint failed,
    count(*) filter (where status in ('pending', 'processing'))::bigint pending,
    count(*) filter (where destination = 'notion' and status = 'failed')::bigint notion_failed,
    count(*) filter (where destination = 'notion' and status in ('pending', 'processing'))::bigint notion_pending,
    min(created_at) filter (where destination = 'notion' and status in ('pending', 'processing')) oldest_notion,
    count(*) filter (where destination = 'push' and status = 'failed')::bigint push_failed
  into delivery_counts
  from app_private.event_deliveries;

  select
    (select count(*) from app_private.uploads where status = 'pending')::bigint upload_pending,
    count(*) filter (where job_type = 'deletion' and status in ('pending', 'processing', 'failed'))::bigint deletion_pending,
    count(*) filter (where job_type = 'deletion' and status = 'failed')::bigint deletion_failed
  into job_counts
  from app_private.background_jobs;

  select coalesce((
    select to_jsonb(row) from (
      select status, started_at, completed_at, error_detail, result, last_attempt_id as failure_id
      from app_private.background_jobs
      where job_type = 'retention_cleanup'
      order by created_at desc limit 1
    ) row
  ), '{}'::jsonb) value
  into maintenance;

  select coalesce(jsonb_agg(item order by updated_at desc), '[]'::jsonb) value
  into recent_failures
  from (
    select
      d.id::text as id,
      'delivery:' || d.destination as source,
      d.status,
      coalesce(d.last_attempt_id::text, '') as failure_id,
      e.event_type as detail_type,
      e.aggregate_type as target_type,
      e.aggregate_id as target_id,
      d.attempt_count,
      d.next_attempt_at,
      d.created_at,
      d.updated_at
    from app_private.event_deliveries d
    join app_private.domain_events e on e.event_id = d.event_id
    where d.status = 'failed'
    union all
    select
      j.id::text,
      'job:' || j.job_type,
      j.status,
      coalesce(j.last_attempt_id::text, ''),
      j.job_type,
      j.scope_id,
      j.id::text,
      j.attempt_count,
      j.next_attempt_at,
      j.created_at,
      j.updated_at
    from app_private.background_jobs j
    where j.status = 'failed'
    order by updated_at desc limit 12
  ) item;

  return jsonb_build_object(
    'counters', counters.value,
    'issues_by_category', category_counters.issues,
    'comments_by_category', category_counters.comments,
    'last_activity_at', activity.value,
    'delivery_failed', delivery_counts.failed,
    'delivery_pending', delivery_counts.pending,
    'notion_failed', delivery_counts.notion_failed,
    'notion_pending', delivery_counts.notion_pending,
    'oldest_pending_notion_at', delivery_counts.oldest_notion,
    'push_failed', delivery_counts.push_failed,
    'upload_pending', job_counts.upload_pending,
    'deletion_pending', job_counts.deletion_pending,
    'deletion_failed', job_counts.deletion_failed,
    'maintenance', maintenance.value,
    'recent_failures', recent_failures.value,
    'users_seen', coalesce((counters.value ->> 'users_seen')::bigint, 0)
  );
end;
$$;

create or replace function app_api.backend_set_user_restriction(
  actor_uid text,
  target_uid text,
  restriction_mode text,
  reason text
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  normalized_reason text := nullif(btrim(coalesce(reason, '')), '');
  next_until timestamptz;
  permanent boolean := false;
begin
  if coalesce(btrim(actor_uid), '') = ''
    or coalesce(btrim(target_uid), '') = ''
    or restriction_mode not in ('clear', '7d', '30d', 'permanent')
  then raise exception 'validation-required'; end if;
  if actor_uid = target_uid then raise exception 'permission-denied'; end if;
  if restriction_mode <> 'clear' and normalized_reason is null then raise exception 'validation-required'; end if;
  if char_length(coalesce(normalized_reason, '')) > 500 then raise exception 'validation-invalid'; end if;

  perform 1 from app_private.user_profiles where uid = target_uid for update;
  if not found then raise exception 'not-found'; end if;
  if exists (
    select 1 from app_private.user_role_assignments
    where uid = target_uid and role_code = 'platform-admin'
  ) then raise exception 'permission-denied'; end if;

  if restriction_mode = 'clear' then
    delete from app_private.user_restrictions where uid = target_uid;
  else
    if restriction_mode = '7d' then next_until := now() + interval '7 days';
    elsif restriction_mode = '30d' then next_until := now() + interval '30 days';
    else permanent := true;
    end if;
    insert into app_private.user_restrictions(
      uid, restricted_until, restricted_permanently, reason, updated_by, updated_at
    ) values (
      target_uid, next_until, permanent, normalized_reason, actor_uid, now()
    ) on conflict(uid) do update set
      restricted_until = excluded.restricted_until,
      restricted_permanently = excluded.restricted_permanently,
      reason = excluded.reason,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  end if;

  return jsonb_build_object(
    'success', true,
    'uid', target_uid,
    'restrictedUntil', next_until,
    'restrictedPermanently', permanent
  );
end;
$$;

-- 15. Update Serializers to strictly return camelCase & ISO-8601 strings (no _ms)
create or replace function app_api.backend_list_admin_users(
  search_query text default '',
  page_limit integer default 80
)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  with settings as (
    select
      lower(btrim(coalesce(search_query, ''))) query,
      least(greatest(coalesce(page_limit, 80), 1), 100) limited_size
  ),
  matching_profiles as (
    select
      profile.uid,
      profile.email,
      profile.display_name,
      profile.created_at,
      profile.last_seen_at,
      restriction.restricted_until,
      coalesce(restriction.restricted_permanently, false) restricted_permanently,
      coalesce(restriction.reason, '') restriction_reason
    from app_private.user_profiles profile
    left join app_private.user_restrictions restriction on restriction.uid = profile.uid
    cross join settings
    where settings.query = ''
      or lower(profile.uid) like '%' || settings.query || '%'
      or lower(coalesce(profile.email, '')) like '%' || settings.query || '%'
      or lower(coalesce(profile.display_name, '')) like '%' || settings.query || '%'
  ),
  limited_profiles as (
    select *
    from matching_profiles
    order by last_seen_at desc nulls last, created_at desc, uid
    limit (select limited_size from settings)
  ),
  rows as (
    select
      profile.*,
      coalesce((
        select jsonb_agg(assignment.role_code order by assignment.role_code)
        from app_private.user_role_assignments assignment
        where assignment.uid = profile.uid
      ), '[]'::jsonb) roles,
      coalesce((
        select jsonb_agg(assignment.category_id order by assignment.category_id)
        from app_private.user_issue_category_assignments assignment
        where assignment.uid = profile.uid
      ), '[]'::jsonb) managed_issue_category_ids,
      coalesce((
        select jsonb_agg(assignment.category_id order by assignment.category_id)
        from app_private.user_facility_category_assignments assignment
        where assignment.uid = profile.uid
      ), '[]'::jsonb) managed_facility_category_ids
    from limited_profiles profile
  )
  select jsonb_build_object(
    'truncated', (select count(*) from matching_profiles) > (select limited_size from settings),
    'users', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'uid', uid,
          'email', email,
          'name', coalesce(nullif(display_name, ''), email, uid),
          'createdAt', created_at,
          'lastSeenAt', last_seen_at,
          'restrictedUntil', restricted_until,
          'restrictedPermanently', restricted_permanently,
          'restrictionReason', restriction_reason,
          'roles', roles,
          'managedIssueCategoryIds', managed_issue_category_ids,
          'managedFacilityCategoryIds', managed_facility_category_ids
        )
        order by last_seen_at desc nulls last, created_at desc, uid
      )
      from rows
    ), '[]'::jsonb)
  );
$$;

create or replace function app_api.backend_issue_to_json(
  issue_record app_private.issues,
  actor_uid text,
  actor_is_admin boolean,
  private_to_owner_categories text[],
  review_required_categories text[],
  author_private_categories text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  is_own_issue boolean := issue_record.author_uid = actor_uid;
  can_manage_issue boolean := actor_is_admin or is_own_issue;
  can_view_author boolean := actor_is_admin or is_own_issue or issue_record.author_visible;
  current_user_supported boolean;
begin
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'owner-admin' then
    raise exception 'not-found';
  end if;
  if not actor_is_admin and not is_own_issue and issue_record.read_access = 'reviewed-school'
    and issue_record.status in ('under-review', 'review-rejected') then
    raise exception 'not-found';
  end if;
  select exists(
    select 1 from app_private.supports support
    where support.issue_id = issue_record.id and support.uid = actor_uid
  ) into current_user_supported;

  return jsonb_build_object(
    'id', issue_record.id,
    'title', issue_record.title,
    'content', issue_record.content,
    'category', issue_record.category,
    'status', issue_record.status,
    'revision', issue_record.revision,
    'commentsEnabled', issue_record.comments_enabled,
    'readAccess', issue_record.read_access,
    'supportEnabled', issue_record.support_enabled,
    'supportGoal', issue_record.support_goal,
    'supportCount', issue_record.support_count,
    'supportDeadlineAt', issue_record.support_deadline_at,
    'responseDeadlineAt', issue_record.response_deadline_at,
    'reviewApprovedAt', issue_record.review_approved_at,
    'reviewRejectionReason', issue_record.review_rejection_reason,
    'resultContent', issue_record.result_content,
    'supportMetAt', issue_record.support_met_at,
    'closedAt', issue_record.closed_at,
    'createdAt', issue_record.created_at,
    'currentUserSupported', current_user_supported,
    'isOwnIssue', is_own_issue,
    'canManageIssue', can_manage_issue,
    'canViewAuthor', can_view_author,
    'authorUid', case when can_view_author then issue_record.author_uid else null end
  );
end;
$$;

create or replace function app_api.backend_announcement_to_json(
  announcement_record app_private.announcements,
  actor_uid text
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  current_user_liked boolean;
  global_comments_enabled boolean;
begin
  select exists(
    select 1 from app_private.announcement_likes
    where announcement_id = announcement_record.id and uid = actor_uid
  ) into current_user_liked;
  select announcement_comments_enabled into global_comments_enabled
  from app_private.system_setup where singleton;
  return jsonb_build_object(
    'id', announcement_record.id,
    'authorUid', announcement_record.author_uid,
    'title', announcement_record.title,
    'content', announcement_record.content,
    'likeCount', announcement_record.like_count,
    'commentCount', announcement_record.comment_count,
    'commentsEnabled', announcement_record.comments_enabled,
    'commentsGloballyEnabled', coalesce(global_comments_enabled, false),
    'revision', announcement_record.revision,
    'publishedAt', announcement_record.published_at,
    'currentUserLiked', current_user_liked
  );
end;
$$;

create or replace function app_api.backend_comment_to_json(
  comment_record app_private.comments,
  replies jsonb default '[]'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  select jsonb_build_object(
    'id', comment_record.id,
    'issueId', comment_record.issue_id,
    'parentCommentId', comment_record.parent_comment_id,
    'authorUid', comment_record.author_uid,
    'content', comment_record.content,
    'revision', comment_record.revision,
    'createdAt', comment_record.created_at,
    'replies', coalesce(replies, '[]'::jsonb)
  );
$$;

create or replace function app_api.backend_announcement_comment_to_json(
  comment_record app_private.announcement_comments,
  replies jsonb default '[]'::jsonb
)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  select jsonb_build_object(
    'id', comment_record.id,
    'announcementId', comment_record.announcement_id,
    'parentCommentId', comment_record.parent_comment_id,
    'authorUid', comment_record.author_uid,
    'content', comment_record.content,
    'revision', comment_record.revision,
    'createdAt', comment_record.created_at,
    'replies', coalesce(replies, '[]'::jsonb)
  );
$$;

create or replace function app_api.backend_notification_to_json(
  notification_record app_private.notifications,
  opened_at timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  select jsonb_build_object(
    'id', notification_record.id,
    'source', notification_record.source,
    'recipientUid', notification_record.recipient_uid,
    'type', notification_record.type,
    'targetType', notification_record.target_type,
    'targetId', notification_record.target_id,
    'commentId', notification_record.comment_id,
    'title', notification_record.title,
    'actorUid', notification_record.actor_uid,
    'bodyPreview', notification_record.body_preview,
    'issueCategory', notification_record.issue_category,
    'oldStatus', notification_record.old_status,
    'newStatus', notification_record.new_status,
    'createdAt', notification_record.created_at,
    'expiresAt', notification_record.expires_at,
    'origin', notification_record.origin,
    'isRead', case when opened_at is null then false else notification_record.created_at <= opened_at end
  );
$$;

create or replace function app_api.backend_notification_state_to_json(
  state_record app_private.notification_states
)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  select jsonb_build_object(
    'uid', state_record.uid,
    'broadcastOpenedAt', state_record.broadcast_opened_at,
    'adminOpenedAt', state_record.admin_opened_at,
    'userOpenedAt', state_record.user_opened_at,
    'pushCommentsEnabled', state_record.push_comments_enabled,
    'pushIssueUpdatesEnabled', state_record.push_issue_updates_enabled,
    'pushFacilityUpdatesEnabled', state_record.push_facility_updates_enabled,
    'updatedAt', state_record.updated_at
  );
$$;

create or replace function app_api.backend_get_notification_read_state(actor_uid text)
returns jsonb
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  select coalesce(
    (
      select app_api.backend_notification_state_to_json(state_record)
      from app_private.notification_states state_record
      where state_record.uid = actor_uid
    ),
    jsonb_build_object(
      'uid', actor_uid,
      'broadcastOpenedAt', null,
      'adminOpenedAt', null,
      'userOpenedAt', null,
      'pushCommentsEnabled', true,
      'pushIssueUpdatesEnabled', true,
      'pushFacilityUpdatesEnabled', true,
      'updatedAt', null
    )
  );
$$;

-- 16. Remove direct outbox writes from mutation functions
create or replace function app_api.backend_create_facility(
  actor_uid text,
  facility_title text,
  facility_location text,
  facility_content text,
  facility_category text
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  facility app_private.facility_reports%rowtype;
begin
  insert into app_private.facility_reports(
    title, title_search, location, content, category_id, author_uid, last_actor_uid, status
  ) values (
    facility_title, lower(facility_title), facility_location, facility_content,
    facility_category, actor_uid, actor_uid, 'pending'
  ) returning * into facility;

  return to_jsonb(facility) || jsonb_build_object(
    'isOwnFacility', true, 'currentUserAffected', true, 'canManageFacility', false
  );
end;
$$;

create or replace function app_api.backend_update_facility_status(
  facility_id uuid,
  actor_uid text,
  actor_can_manage boolean,
  next_status text,
  result_content text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  report_record app_private.facility_reports%rowtype;
begin
  select * into report_record
  from app_private.facility_reports where id = facility_id for update;
  if not found then raise exception 'not-found'; end if;
  if not actor_can_manage then raise exception 'permission-denied'; end if;
  if next_status in ('completed', 'unable-to-handle') and coalesce(length(btrim(backend_update_facility_status.result_content)), 0) = 0 then
    raise exception 'missing-result';
  end if;

  update app_private.facility_reports
  set status = next_status,
      result_content = coalesce(backend_update_facility_status.result_content, facility_reports.result_content),
      last_actor_uid = actor_uid,
      closed_at = case when next_status in ('completed', 'unable-to-handle') then now() else null end,
      started_at = case when next_status = 'processing' and started_at is null then now() else started_at end,
      updated_at = now()
  where id = facility_id
  returning * into report_record;

  return to_jsonb(report_record) || jsonb_build_object(
    'isOwnFacility', report_record.author_uid = actor_uid,
    'canManageFacility', true,
    'currentUserAffected', exists(
      select 1 from app_private.facility_report_affected_users fau
      where fau.facility_id = report_record.id and fau.uid = actor_uid
    )
  );
end;
$$;

create or replace function app_api.backend_delete_facility(
  facility_id uuid,
  actor_uid text,
  actor_can_manage boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  report_record app_private.facility_reports%rowtype;
begin
  select * into report_record
  from app_private.facility_reports where id = facility_id for update;
  if not found then return jsonb_build_object('success', true); end if;
  if not actor_can_manage and report_record.author_uid <> actor_uid then
    raise exception 'permission-denied';
  end if;

  delete from app_private.notifications notification
  where notification.target_type = 'facility' and notification.target_id = report_record.id::text;
  delete from app_private.facility_reports where id = report_record.id;
  return jsonb_build_object('success', true);
end;
$$;

create or replace function app_api.backend_delete_issue(
  issue_id uuid,
  actor_uid text,
  actor_is_admin boolean
)
returns void
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  issue_record app_private.issues%rowtype;
begin
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then return; end if;
  if issue_record.author_uid <> actor_uid and not actor_is_admin then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  delete from app_private.notifications notification
  where notification.target_type = 'issue' and notification.target_id = issue_record.id::text;
  delete from app_private.issues where id = issue_record.id;
end;
$$;

drop function if exists app_api.backend_moderate_issue_status(uuid,text,boolean,text,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,text[],text[],text[]);
create or replace function app_api.backend_moderate_issue_status(
  issue_id uuid,
  actor_uid text,
  actor_is_admin boolean,
  next_status text,
  review_rejection_reason text,
  support_deadline_at timestamptz,
  response_deadline_at timestamptz,
  review_approved_at timestamptz,
  private_to_owner_categories text[],
  review_required_categories text[],
  author_private_categories text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  issue_record app_private.issues%rowtype;
begin
  if not actor_is_admin then raise exception 'permission-denied'; end if;
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;

  update app_private.issues
  set status = next_status,
      review_rejection_reason = case when next_status = 'review-rejected' then backend_moderate_issue_status.review_rejection_reason else null end,
      support_deadline_at = coalesce(backend_moderate_issue_status.support_deadline_at, issues.support_deadline_at),
      response_deadline_at = coalesce(backend_moderate_issue_status.response_deadline_at, issues.response_deadline_at),
      review_approved_at = coalesce(backend_moderate_issue_status.review_approved_at, issues.review_approved_at),
      closed_at = case when next_status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed') then now() else null end
  where id = issue_id
  returning * into issue_record;

  return app_api.backend_issue_to_json(
    issue_record, actor_uid, actor_is_admin,
    private_to_owner_categories, review_required_categories, author_private_categories
  );
end;
$$;

create or replace function app_api.backend_update_issue_result(
  issue_id uuid,
  actor_uid text,
  actor_is_admin boolean,
  result_content text,
  private_to_owner_categories text[],
  review_required_categories text[],
  author_private_categories text[]
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  issue_record app_private.issues%rowtype;
begin
  if not actor_is_admin then raise exception 'permission-denied'; end if;
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;

  update app_private.issues
  set last_actor_uid = backend_update_issue_result.actor_uid,
      result_content = backend_update_issue_result.result_content
  where id = backend_update_issue_result.issue_id
  returning * into issue_record;

  return app_api.backend_issue_to_json(
    issue_record, actor_uid, actor_is_admin,
    private_to_owner_categories, review_required_categories, author_private_categories
  );
end;
$$;

create or replace function app_api.backend_toggle_support(
  issue_id uuid,
  actor_uid text,
  remove_support boolean,
  response_deadline_days integer default null
)
returns table(supported boolean, support_count integer, goal_met boolean)
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  issue_record app_private.issues%rowtype;
  already_supported boolean;
  next_support_count integer;
  became_goal_met boolean := false;
begin
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;
  if not issue_record.support_enabled then raise exception 'support-disabled'; end if;

  select exists(
    select 1 from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and supports.uid = actor_uid
  ) into already_supported;

  if remove_support then
    if already_supported then
      delete from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and supports.uid = actor_uid;
    end if;
  else
    if not already_supported then
      insert into app_private.supports(issue_id, uid) values (issue_id, actor_uid);
    end if;
  end if;

  select count(*)::integer into next_support_count from app_private.supports where supports.issue_id = backend_toggle_support.issue_id;

  if not remove_support and issue_record.support_goal is not null and next_support_count >= issue_record.support_goal and issue_record.support_met_at is null then
    became_goal_met := true;
    update app_private.issues
    set support_count = next_support_count,
        support_met_at = now(),
        status = case when status = 'pending' then 'processing' else status end,
        response_deadline_at = case
          when response_deadline_days is not null then now() + make_interval(days => response_deadline_days)
          else response_deadline_at
        end
    where id = issue_id;
  else
    update app_private.issues
    set support_count = next_support_count
    where id = issue_id;
  end if;

  return query select not remove_support, next_support_count, became_goal_met;
end;
$$;

create or replace function app_api.backend_commit_user_avatar(
  actor_uid text,
  next_avatar_hash text,
  next_avatar_public_id text,
  next_avatar_source_url text,
  next_cached_photo_url text,
  next_avatar_version integer,
  next_display_name text
) returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  previous_public_id text;
  committed_version integer;
begin
  select avatar_public_id into previous_public_id
  from app_private.user_profiles where uid = actor_uid for update;

  committed_version := greatest(coalesce((
    select avatar_version + 1 from app_private.user_profiles where uid = actor_uid
  ), 1), next_avatar_version);

  insert into app_private.user_profiles (
    uid, avatar_hash, avatar_public_id, avatar_source_url, avatar_checked_at,
    avatar_version, display_name, photo_url, cached_photo_url, updated_at
  ) values (
    actor_uid, next_avatar_hash, next_avatar_public_id, next_avatar_source_url, now(),
    committed_version, next_display_name, next_avatar_source_url, next_cached_photo_url, now()
  ) on conflict (uid) do update set
    avatar_hash = excluded.avatar_hash,
    avatar_public_id = excluded.avatar_public_id,
    avatar_source_url = excluded.avatar_source_url,
    avatar_checked_at = excluded.avatar_checked_at,
    avatar_version = excluded.avatar_version,
    display_name = excluded.display_name,
    photo_url = excluded.photo_url,
    cached_photo_url = excluded.cached_photo_url,
    updated_at = excluded.updated_at;

  if previous_public_id is not null and previous_public_id <> next_avatar_public_id then
    insert into app_private.background_jobs (
      job_type,
      scope_id,
      payload,
      status
    ) values (
      'deletion',
      actor_uid,
      jsonb_build_object(
        'cloudinary_public_id', previous_public_id,
        'target_id', actor_uid,
        'target_type', 'avatar'
      ),
      'pending'
    );
  end if;

  return jsonb_build_object(
    'photoUrl', next_cached_photo_url,
    'avatarVersion', committed_version
  );
end;
$$;

create or replace function app_api.backend_list_deletion_jobs(
  actor_uid text,
  page_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  limited_size integer := least(greatest(coalesce(page_limit, 50), 1), 100);
begin
  if not exists (
    select 1
    from app_private.user_role_assignments assignment
    join app_private.role_permissions permission
      on permission.role_code = assignment.role_code
    where assignment.uid = backend_list_deletion_jobs.actor_uid
      and permission.permission_code = 'dashboard.view'
  ) then
    raise exception 'permission-denied';
  end if;

  return jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', job.id,
          'targetType', coalesce(job.payload->>'target_type', job.payload->>'targetType'),
          'targetId', coalesce(job.payload->>'target_id', job.payload->>'targetId', job.scope_id),
          'cloudinaryPublicId', coalesce(job.payload->>'cloudinary_public_id', job.payload->>'cloudinaryPublicId'),
          'status', job.status,
          'attemptCount', job.attempt_count,
          'nextAttemptAt', job.next_attempt_at,
          'failureId', job.last_attempt_id,
          'createdAt', job.created_at,
          'updatedAt', job.updated_at
        )
        order by job.updated_at desc, job.id desc
      )
      from (
        select *
        from app_private.background_jobs
        where job_type = 'deletion' and status = 'failed'
        order by updated_at desc, id desc
        limit limited_size
      ) job
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function app_api.backend_retry_deletion_job(
  actor_uid text,
  job_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  job app_private.background_jobs%rowtype;
begin
  if not exists (
    select 1
    from app_private.user_role_assignments assignment
    join app_private.role_permissions permission
      on permission.role_code = assignment.role_code
    where assignment.uid = backend_retry_deletion_job.actor_uid
      and permission.permission_code = 'role.manage'
  ) then
    raise exception 'permission-denied';
  end if;

  select * into job
  from app_private.background_jobs
  where id = backend_retry_deletion_job.job_id
  for update;

  if not found then raise exception 'not-found'; end if;
  if job.status <> 'failed' then raise exception 'validation-invalid'; end if;

  update app_private.background_jobs
  set status = 'pending',
      attempt_count = 0,
      next_attempt_at = now(),
      last_attempt_id = null,
      locked_at = null,
      updated_at = now()
  where id = job.id;

  return jsonb_build_object(
    'id', job.id,
    'status', 'pending',
    'queuedAt', now()
  );
end;
$$;

create or replace function app_private.queue_deleted_content_uploads()
returns trigger
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  removed_upload_ids uuid[];
  target_type_name text;
begin
  target_type_name := case tg_table_name
    when 'issues' then 'issue'
    when 'comments' then 'comment'
    when 'announcements' then 'announcement'
    when 'announcement_comments' then 'announcement_comment'
    when 'facility_reports' then 'facility'
    else null
  end;
  if target_type_name is null then raise exception 'unsupported-upload-target'; end if;

  select coalesce(array_agg(id), array[]::uuid[]) into removed_upload_ids
  from app_private.uploads
  where attached_target_type = target_type_name and attached_target_id = old.id;

  if cardinality(removed_upload_ids) > 0 then
    insert into app_private.background_jobs(job_type, scope_id, payload, created_by)
    select 'deletion', id::text, jsonb_build_object('target_type', 'upload', 'target_id', id::text, 'cloudinary_public_id', cloudinary_public_id), 'trigger'
    from app_private.uploads where id = any(removed_upload_ids);

    delete from app_private.uploads where id = any(removed_upload_ids);
  end if;
  return old;
end;
$$;

create or replace function app_api.backend_delete_issue_with_upload_targets(
  issue_id uuid,
  actor_uid text,
  actor_is_admin boolean
) returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  issue_record app_private.issues%rowtype;
  upload_targets jsonb;
  supporter_uids jsonb;
begin
  select * into issue_record
  from app_private.issues
  where id = backend_delete_issue_with_upload_targets.issue_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', true,
      'issueId', backend_delete_issue_with_upload_targets.issue_id,
      'uploadTargets', '[]'::jsonb,
      'supporterUids', '[]'::jsonb
    );
  end if;

  if issue_record.author_uid <> backend_delete_issue_with_upload_targets.actor_uid
    and not backend_delete_issue_with_upload_targets.actor_is_admin
  then
    raise exception 'permission-denied';
  end if;

  select jsonb_build_array(jsonb_build_object('id', issue_record.id, 'type', 'issue'))
    || coalesce(jsonb_agg(jsonb_build_object('id', comment.id, 'type', 'comment')), '[]'::jsonb)
  into upload_targets
  from app_private.comments comment
  where comment.issue_id = issue_record.id;

  select coalesce(jsonb_agg(supporter.uid order by supporter.created_at), '[]'::jsonb)
  into supporter_uids
  from app_private.supports supporter
  where supporter.issue_id = issue_record.id;

  delete from app_private.issues where id = issue_record.id;

  return jsonb_build_object(
    'success', true,
    'issueId', issue_record.id,
    'authorUid', issue_record.author_uid,
    'issueCategory', issue_record.category,
    'supporterUids', supporter_uids,
    'title', issue_record.title,
    'uploadTargets', upload_targets
  );
end;
$$;

create or replace function app_private.attach_markdown_uploads_from_content()
returns trigger
language plpgsql
security definer
set search_path to 'app_private', 'public'
as $$
declare
  target_type_name text;
  upload_ids uuid[];
  valid_upload_count integer;
  removed_upload_ids uuid[];
begin
  target_type_name := case tg_table_name
    when 'issues' then 'issue'
    when 'comments' then 'comment'
    when 'announcements' then 'announcement'
    when 'announcement_comments' then 'announcement_comment'
    when 'facility_reports' then 'facility'
    else null
  end;
  if target_type_name is null then raise exception 'unsupported-upload-target'; end if;

  select coalesce(array_agg(distinct captures[1]::uuid), array[]::uuid[])
  into upload_ids
  from regexp_matches(coalesce(new.content, ''), 'srp-upload://([0-9a-fA-F-]{36})', 'g') as captures;
  if cardinality(upload_ids) > 0 then
    select count(*) into valid_upload_count
    from app_private.uploads
    where id = any(upload_ids) and owner_uid = new.author_uid
      and (
        (status = 'ready' and attached_target_id is null)
        or (status = 'attached' and attached_target_type = target_type_name and attached_target_id = new.id)
      );
    if valid_upload_count <> cardinality(upload_ids) then raise exception 'upload-attachment-invalid'; end if;
    update app_private.uploads set attached_target_id = new.id, attached_target_type = target_type_name,
      status = 'attached', updated_at = now()
    where id = any(upload_ids) and owner_uid = new.author_uid;
  end if;
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(id), array[]::uuid[]) into removed_upload_ids
    from app_private.uploads where attached_target_type = target_type_name and attached_target_id = new.id
      and not (id = any(upload_ids));
    if cardinality(removed_upload_ids) > 0 then
      insert into app_private.background_jobs(job_type, scope_id, payload, created_by)
      select 'deletion', id::text, jsonb_build_object('target_type', 'upload', 'target_id', id::text, 'cloudinary_public_id', cloudinary_public_id), 'trigger'
      from app_private.uploads where id = any(removed_upload_ids);
      delete from app_private.uploads where id = any(removed_upload_ids);
    end if;
  end if;
  return new;
end;
$$;

-- 17. Permissions
revoke all on schema app_private from public;
grant usage on schema app_private, app_api to novae_runtime;
grant select, insert, update, delete on all tables in schema app_private to novae_runtime;
grant usage, select on all sequences in schema app_private to novae_runtime;
grant execute on all functions in schema app_private, app_api to novae_runtime;
