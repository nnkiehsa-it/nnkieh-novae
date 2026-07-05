-- Complete support lifecycle, recover abandoned work, and provide durable dashboard counters.

alter table app_private.deletion_jobs
  add column if not exists locked_at timestamptz;

alter table app_private.outbox_events
  add column if not exists notification_completed_at timestamptz,
  add column if not exists notion_completed_at timestamptz;

create table if not exists app_private.platform_counters (
  key text primary key,
  value bigint not null default 0 check (value >= 0),
  updated_at timestamptz not null default now()
);
alter table app_private.platform_counters enable row level security;
grant all privileges on app_private.platform_counters to service_role;

insert into app_private.platform_counters(key, value)
values
  ('issues_created', (select count(*) from app_private.issues)),
  ('issues_deleted', 0),
  ('comments_created', (select count(*) from app_private.comments) + (select count(*) from app_private.announcement_comments)),
  ('comments_deleted', 0),
  ('supports_added', (select count(*) from app_private.supports)),
  ('supports_removed', 0)
on conflict (key) do nothing;

create or replace function app_private.increment_platform_counter(counter_key text, amount bigint default 1)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  insert into app_private.platform_counters(key, value)
  values (counter_key, greatest(amount, 0))
  on conflict (key) do update
  set value = app_private.platform_counters.value + greatest(excluded.value, 0),
      updated_at = now();
$$;

create or replace function app_private.track_platform_row_change()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  if tg_table_name = 'issues' then
    perform app_private.increment_platform_counter(case when tg_op = 'INSERT' then 'issues_created' else 'issues_deleted' end);
  elsif tg_table_name in ('comments', 'announcement_comments') then
    perform app_private.increment_platform_counter(case when tg_op = 'INSERT' then 'comments_created' else 'comments_deleted' end);
  elsif tg_table_name = 'supports' then
    perform app_private.increment_platform_counter(case when tg_op = 'INSERT' then 'supports_added' else 'supports_removed' end);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists track_issue_counters on app_private.issues;
create trigger track_issue_counters after insert or delete on app_private.issues
for each row execute function app_private.track_platform_row_change();
drop trigger if exists track_comment_counters on app_private.comments;
create trigger track_comment_counters after insert or delete on app_private.comments
for each row execute function app_private.track_platform_row_change();
drop trigger if exists track_announcement_comment_counters on app_private.announcement_comments;
create trigger track_announcement_comment_counters after insert or delete on app_private.announcement_comments
for each row execute function app_private.track_platform_row_change();
drop trigger if exists track_support_counters on app_private.supports;
create trigger track_support_counters after insert or delete on app_private.supports
for each row execute function app_private.track_platform_row_change();

create or replace function app_api.backend_toggle_support(
  issue_id uuid,
  actor_uid text,
  remove_support boolean,
  response_deadline_days integer
)
returns table(supported boolean, support_count integer, goal_met boolean)
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  issue_record app_private.issues%rowtype;
  existing boolean;
  next_count integer;
  reached_goal boolean := false;
begin
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;
  if issue_record.status <> 'pending'
    or not issue_record.support_enabled
    or issue_record.support_met_at is not null
    or (issue_record.support_deadline_at is not null and issue_record.support_deadline_at <= now())
  then raise exception 'support-not-available'; end if;

  select exists(select 1 from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and uid = actor_uid)
  into existing;
  if remove_support or existing then
    delete from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and uid = actor_uid;
    supported := false;
  else
    insert into app_private.supports(issue_id, uid) values (backend_toggle_support.issue_id, actor_uid);
    supported := true;
  end if;

  select issues.support_count into next_count from app_private.issues where id = backend_toggle_support.issue_id;
  if supported and issue_record.support_goal is not null and next_count >= issue_record.support_goal then
    update app_private.issues
    set support_met_at = coalesce(support_met_at, now()),
        response_deadline_at = case when response_deadline_days is null then null else now() + make_interval(days => response_deadline_days) end
    where id = backend_toggle_support.issue_id and support_met_at is null;
    reached_goal := found;
  end if;
  insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
  values (
    case when supported then 'support.created' else 'support.deleted' end,
    'issue', issue_id::text, actor_uid,
    jsonb_build_object(
      'author_uid', issue_record.author_uid, 'issue_category', issue_record.category,
      'new_support_count', next_count, 'support_goal', issue_record.support_goal, 'title', issue_record.title
    )
  );
  if reached_goal then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values (
      'support.goal_met', 'issue', issue_id::text, actor_uid,
      jsonb_build_object(
        'author_uid', issue_record.author_uid, 'issue_category', issue_record.category,
        'new_support_count', next_count, 'support_goal', issue_record.support_goal, 'title', issue_record.title
      )
    );
  end if;
  support_count := next_count;
  goal_met := reached_goal;
  return next;
end;
$$;
revoke all on function app_api.backend_toggle_support(uuid,text,boolean,integer) from public, anon, authenticated;
grant execute on function app_api.backend_toggle_support(uuid,text,boolean,integer) to service_role;

create or replace function app_private.reject_expired_support_issues()
returns integer
language plpgsql
security definer
set search_path = app_private, public
as $$
declare changed integer;
begin
  with expired as (
    update app_private.issues
    set status = 'auto-rejected', updated_at = now()
    where status = 'pending'
      and support_enabled
      and support_met_at is null
      and support_deadline_at is not null
      and support_deadline_at <= now()
      and support_goal is not null
      and support_count < support_goal
    returning *
  ), queued as (
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    select 'issue.status_changed', 'issue', id::text, 'system',
      jsonb_build_object(
        'author_uid', author_uid, 'old_status', 'pending', 'new_status', 'auto-rejected',
        'issue_category', category, 'title', title, 'support_count', support_count, 'support_goal', support_goal
      )
    from expired returning 1
  )
  select count(*) into changed from queued;
  return changed;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'srp_expire_support_issues';
    perform cron.schedule('srp_expire_support_issues', '7 * * * *', 'select app_private.reject_expired_support_issues();');
  end if;
end $$;

create or replace function app_private.signal_deletion_worker()
returns trigger
language plpgsql
security definer
set search_path = app_private, extensions, public
as $$
declare
  worker_url text;
  webhook_secret text;
begin
  select value into worker_url from app_private.runtime_settings where key = 'deletion_worker_url';
  select value into webhook_secret from app_private.runtime_settings where key = 'webhook_secret';
  if worker_url is null or webhook_secret is null then return null; end if;
  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || webhook_secret),
    body := jsonb_build_object('signal', 'deletion_insert')
  );
  return null;
end;
$$;
drop trigger if exists deletion_worker_wakeup on app_private.deletion_jobs;
create trigger deletion_worker_wakeup after insert on app_private.deletion_jobs
for each statement execute function app_private.signal_deletion_worker();

create or replace function app_api.claim_outbox_events(batch_size integer default 100)
returns setof app_private.outbox_events
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  return query
  with claimed as (
    select id from app_private.outbox_events
    where (
      status in ('pending', 'failed') and next_attempt_at <= now()
    ) or (
      status = 'processing' and locked_at < now() - interval '10 minutes'
    )
    order by occurred_at asc
    limit greatest(1, least(batch_size, 100))
    for update skip locked
  )
  update app_private.outbox_events event
  set status = 'processing', attempt_count = event.attempt_count + 1,
      locked_at = now(), updated_at = now()
  from claimed where event.id = claimed.id returning event.*;
end;
$$;

create or replace function app_api.claim_deletion_jobs(batch_size integer default 50)
returns setof app_private.deletion_jobs
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  return query
  with claimed as (
    select id from app_private.deletion_jobs
    where (
      status in ('pending', 'failed') and next_attempt_at <= now()
    ) or (
      status = 'processing' and locked_at < now() - interval '10 minutes'
    )
    order by created_at asc
    limit greatest(1, least(batch_size, 50))
    for update skip locked
  )
  update app_private.deletion_jobs job
  set status = 'processing', attempt_count = job.attempt_count + 1,
      locked_at = now(), updated_at = now()
  from claimed where job.id = claimed.id returning job.*;
end;
$$;

create or replace function app_api.claim_idempotency_key(actor_uid text, action_name text, request_id text)
returns table(claimed boolean, completed boolean, response jsonb)
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  existing app_private.idempotency_keys%rowtype;
  inserted_count integer := 0;
begin
  if length(btrim(coalesce(actor_uid,''))) = 0 or length(btrim(coalesce(action_name,''))) = 0
    or length(btrim(coalesce(request_id,''))) = 0 or length(request_id) > 120
  then raise exception 'invalid idempotency key' using errcode = '22023'; end if;
  insert into app_private.idempotency_keys(uid,action,request_id)
  values(actor_uid,action_name,request_id) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  select * into existing from app_private.idempotency_keys
  where uid=actor_uid and action=action_name and idempotency_keys.request_id=claim_idempotency_key.request_id
  for update;
  if inserted_count = 1 then return query select true,false,null::jsonb; return; end if;
  if existing.status = 'completed' then return query select false,true,existing.response; return; end if;
  if existing.updated_at < now() - interval '10 minutes' then
    update app_private.idempotency_keys set updated_at=now(), expires_at=now()+interval '1 day'
    where uid=actor_uid and action=action_name and idempotency_keys.request_id=claim_idempotency_key.request_id;
    return query select true,false,null::jsonb; return;
  end if;
  return query select false,false,null::jsonb;
end;
$$;
