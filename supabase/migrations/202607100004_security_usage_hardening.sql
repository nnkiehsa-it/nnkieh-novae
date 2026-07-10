-- Keep content writes atomic, scope realtime invalidations, and bound background retries.

create or replace function app_private.attach_markdown_uploads_from_content()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  upload_ids uuid[];
  removed_upload_ids uuid[];
  target_type_name text;
  valid_upload_count integer;
begin
  select coalesce(array_agg(distinct captures[1]::uuid), array[]::uuid[])
  into upload_ids
  from regexp_matches(
    coalesce(new.content, ''),
    'srp-upload://([0-9a-fA-F-]{36})',
    'g'
  ) as captures;

  target_type_name := case tg_table_name
    when 'issues' then 'issue'
    when 'comments' then 'comment'
    when 'announcements' then 'announcement'
    when 'announcement_comments' then 'announcement_comment'
    else null
  end;
  if target_type_name is null then
    raise exception 'unsupported-upload-target';
  end if;

  if cardinality(upload_ids) > 0 then
    select count(*)
    into valid_upload_count
    from app_private.uploads
    where id = any(upload_ids)
      and (target_type_name = 'announcement' or owner_uid = new.author_uid)
      and status in ('ready', 'attached')
      and (
        attached_target_id is null
        or (
          attached_target_type = target_type_name
          and attached_target_id = new.id::text
        )
      );

    if valid_upload_count <> cardinality(upload_ids) then
      raise exception 'upload-attachment-invalid';
    end if;

    update app_private.uploads
    set
      attached_target_id = new.id::text,
      attached_target_type = target_type_name,
      status = 'attached',
      updated_at = now()
    where id = any(upload_ids)
      and (target_type_name = 'announcement' or owner_uid = new.author_uid);
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(array_agg(id), array[]::uuid[])
    into removed_upload_ids
    from app_private.uploads
    where attached_target_type = target_type_name
      and attached_target_id = new.id::text
      and not (id = any(upload_ids));

    if cardinality(removed_upload_ids) > 0 then
      insert into app_private.deletion_jobs (target_type, target_id, cloudinary_public_id)
      select 'upload', id::text, cloudinary_public_id
      from app_private.uploads
      where id = any(removed_upload_ids);

      delete from app_private.uploads where id = any(removed_upload_ids);
    end if;
  end if;

  return new;
end;
$$;

create or replace function app_private.queue_deleted_content_uploads()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
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
    else null
  end;
  if target_type_name is null then
    raise exception 'unsupported-upload-target';
  end if;

  select coalesce(array_agg(id), array[]::uuid[])
  into removed_upload_ids
  from app_private.uploads
  where attached_target_type = target_type_name
    and attached_target_id = old.id::text;

  if cardinality(removed_upload_ids) > 0 then
    insert into app_private.deletion_jobs (target_type, target_id, cloudinary_public_id)
    select 'upload', id::text, cloudinary_public_id
    from app_private.uploads
    where id = any(removed_upload_ids);

    delete from app_private.uploads where id = any(removed_upload_ids);
  end if;
  return old;
end;
$$;

drop trigger if exists attach_issue_markdown_uploads on app_private.issues;
create trigger attach_issue_markdown_uploads
after insert or update of content on app_private.issues
for each row execute function app_private.attach_markdown_uploads_from_content();

drop trigger if exists attach_comment_markdown_uploads on app_private.comments;
create trigger attach_comment_markdown_uploads
after insert or update of content on app_private.comments
for each row execute function app_private.attach_markdown_uploads_from_content();

drop trigger if exists attach_announcement_markdown_uploads on app_private.announcements;
create trigger attach_announcement_markdown_uploads
after insert or update of content on app_private.announcements
for each row execute function app_private.attach_markdown_uploads_from_content();

drop trigger if exists attach_announcement_comment_markdown_uploads on app_private.announcement_comments;
create trigger attach_announcement_comment_markdown_uploads
after insert or update of content on app_private.announcement_comments
for each row execute function app_private.attach_markdown_uploads_from_content();

drop trigger if exists cleanup_issue_markdown_uploads on app_private.issues;
create trigger cleanup_issue_markdown_uploads after delete on app_private.issues
for each row execute function app_private.queue_deleted_content_uploads();
drop trigger if exists cleanup_comment_markdown_uploads on app_private.comments;
create trigger cleanup_comment_markdown_uploads after delete on app_private.comments
for each row execute function app_private.queue_deleted_content_uploads();
drop trigger if exists cleanup_announcement_markdown_uploads on app_private.announcements;
create trigger cleanup_announcement_markdown_uploads after delete on app_private.announcements
for each row execute function app_private.queue_deleted_content_uploads();
drop trigger if exists cleanup_announcement_comment_markdown_uploads on app_private.announcement_comments;
create trigger cleanup_announcement_comment_markdown_uploads after delete on app_private.announcement_comments
for each row execute function app_private.queue_deleted_content_uploads();

revoke all on function app_private.attach_markdown_uploads_from_content() from public, anon, authenticated;
revoke all on function app_private.queue_deleted_content_uploads() from public, anon, authenticated;

delete from app_private.realtime_events;

drop trigger if exists queue_issue_realtime_on_insert on app_private.issues;
drop trigger if exists queue_issue_realtime_on_update on app_private.issues;
drop trigger if exists queue_issue_realtime_on_delete on app_private.issues;
drop trigger if exists queue_issue_comment_realtime_on_insert on app_private.comments;
drop trigger if exists queue_issue_comment_realtime_on_update on app_private.comments;
drop trigger if exists queue_issue_comment_realtime_on_delete on app_private.comments;
drop trigger if exists queue_announcement_realtime_on_insert on app_private.announcements;
drop trigger if exists queue_announcement_realtime_on_update on app_private.announcements;
drop trigger if exists queue_announcement_realtime_on_delete on app_private.announcements;
drop trigger if exists queue_announcement_comment_realtime_on_insert on app_private.announcement_comments;
drop trigger if exists queue_announcement_comment_realtime_on_update on app_private.announcement_comments;
drop trigger if exists queue_announcement_comment_realtime_on_delete on app_private.announcement_comments;

drop function if exists app_private.emit_content_realtime_event(text, text, text, text, text, text) cascade;

alter table app_private.realtime_events
  drop column if exists actor_uid,
  add column if not exists audience text not null default 'owner-admin'
    check (audience in ('school', 'owner-admin')),
  add column if not exists recipient_uid text,
  add column if not exists support_count integer,
  add column if not exists like_count integer,
  add column if not exists comment_count integer;

alter table app_private.realtime_events
  drop constraint if exists realtime_events_event_type_check;
alter table app_private.realtime_events
  add constraint realtime_events_event_type_check check (
    event_type in (
      'issue_changed',
      'issue_support_changed',
      'issue_comment_changed',
      'announcement_changed',
      'announcement_metrics_changed',
      'announcement_comment_changed'
    )
  );

create index if not exists realtime_events_recipient_idx
  on app_private.realtime_events (recipient_uid, created_at desc)
  where recipient_uid is not null;

create or replace function app_private.runtime_category_matches(setting_key text, category_name text)
returns boolean
language sql
stable
security definer
set search_path = app_private, public
as $$
  select coalesce(
    category_name = any(string_to_array((
      select value
      from app_private.runtime_settings
      where key = setting_key
    ), ',')),
    false
  );
$$;

create or replace function app_private.issue_realtime_audience(category_name text, status_name text)
returns text
language plpgsql
stable
security definer
set search_path = app_private, public
as $$
declare
  settings_ready boolean;
begin
  select count(*) = 2 into settings_ready
  from app_private.runtime_settings
  where key in ('owner_admin_issue_categories', 'reviewed_school_issue_categories');

  if not settings_ready then
    return 'owner-admin';
  end if;
  if app_private.runtime_category_matches('owner_admin_issue_categories', category_name) then
    return 'owner-admin';
  end if;
  if app_private.runtime_category_matches('reviewed_school_issue_categories', category_name)
    and status_name in ('under-review', 'review-rejected')
  then
    return 'owner-admin';
  end if;
  return 'school';
end;
$$;

create or replace function app_private.emit_content_realtime_event(
  event_type text,
  target_type text,
  target_id text,
  parent_id text default null,
  category text default null,
  audience text default 'owner-admin',
  recipient_uid text default null,
  support_count integer default null,
  like_count integer default null,
  comment_count integer default null
)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  insert into app_private.realtime_events (
    event_type,
    target_type,
    target_id,
    parent_id,
    category,
    audience,
    recipient_uid,
    support_count,
    like_count,
    comment_count
  )
  values (
    emit_content_realtime_event.event_type,
    emit_content_realtime_event.target_type,
    emit_content_realtime_event.target_id,
    emit_content_realtime_event.parent_id,
    emit_content_realtime_event.category,
    emit_content_realtime_event.audience,
    emit_content_realtime_event.recipient_uid,
    emit_content_realtime_event.support_count,
    emit_content_realtime_event.like_count,
    emit_content_realtime_event.comment_count
  );
$$;

create or replace function app_private.queue_issue_realtime_event()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  issue_record app_private.issues%rowtype;
  next_event_type text := 'issue_changed';
begin
  if tg_op = 'DELETE' then
    issue_record := old;
  else
    issue_record := new;
  end if;
  if tg_op = 'UPDATE'
    and new.support_count is distinct from old.support_count
    and (to_jsonb(new) - 'support_count') = (to_jsonb(old) - 'support_count')
  then
    next_event_type := 'issue_support_changed';
  end if;
  perform app_private.emit_content_realtime_event(
    next_event_type,
    'issue',
    issue_record.id::text,
    issue_record.id::text,
    issue_record.category,
    app_private.issue_realtime_audience(issue_record.category, issue_record.status),
    issue_record.author_uid,
    issue_record.support_count,
    null,
    null
  );
  return null;
end;
$$;

create or replace function app_private.queue_issue_comment_realtime_event()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  comment_record app_private.comments%rowtype;
  issue_record app_private.issues%rowtype;
begin
  if tg_op = 'DELETE' then
    comment_record := old;
  else
    comment_record := new;
  end if;
  select * into issue_record from app_private.issues where id = comment_record.issue_id;
  perform app_private.emit_content_realtime_event(
    'issue_comment_changed',
    'issue_comment',
    comment_record.id::text,
    comment_record.issue_id::text,
    issue_record.category,
    case when found
      then app_private.issue_realtime_audience(issue_record.category, issue_record.status)
      else 'owner-admin'
    end,
    issue_record.author_uid,
    null,
    null,
    null
  );
  return null;
end;
$$;

create or replace function app_private.queue_announcement_realtime_event()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  announcement_record app_private.announcements%rowtype;
  next_event_type text := 'announcement_changed';
begin
  if tg_op = 'DELETE' then
    announcement_record := old;
  else
    announcement_record := new;
  end if;
  if tg_op = 'UPDATE'
    and (
      new.like_count is distinct from old.like_count
      or new.comment_count is distinct from old.comment_count
    )
    and (to_jsonb(new) - 'like_count' - 'comment_count')
      = (to_jsonb(old) - 'like_count' - 'comment_count')
  then
    next_event_type := 'announcement_metrics_changed';
  end if;
  perform app_private.emit_content_realtime_event(
    next_event_type, 'announcement', announcement_record.id::text,
    announcement_record.id::text, null, 'school', null, null,
    announcement_record.like_count, announcement_record.comment_count
  );
  return null;
end;
$$;

create or replace function app_private.queue_announcement_comment_realtime_event()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  comment_record app_private.announcement_comments%rowtype;
begin
  if tg_op = 'DELETE' then
    comment_record := old;
  else
    comment_record := new;
  end if;
  perform app_private.emit_content_realtime_event(
    'announcement_comment_changed', 'announcement_comment', comment_record.id::text,
    comment_record.announcement_id::text, null, 'school', null, null, null, null
  );
  return null;
end;
$$;

revoke all on function app_private.runtime_category_matches(text,text) from public, anon, authenticated;
revoke all on function app_private.issue_realtime_audience(text,text) from public, anon, authenticated;
revoke all on function app_private.emit_content_realtime_event(text,text,text,text,text,text,text,integer,integer,integer) from public, anon, authenticated;
revoke all on function app_private.queue_issue_realtime_event() from public, anon, authenticated;
revoke all on function app_private.queue_issue_comment_realtime_event() from public, anon, authenticated;
revoke all on function app_private.queue_announcement_realtime_event() from public, anon, authenticated;
revoke all on function app_private.queue_announcement_comment_realtime_event() from public, anon, authenticated;

create trigger queue_issue_realtime_on_insert after insert on app_private.issues
for each row execute function app_private.queue_issue_realtime_event();
create trigger queue_issue_realtime_on_update after update on app_private.issues
for each row execute function app_private.queue_issue_realtime_event();
create trigger queue_issue_realtime_on_delete after delete on app_private.issues
for each row execute function app_private.queue_issue_realtime_event();
create trigger queue_issue_comment_realtime_on_insert after insert on app_private.comments
for each row execute function app_private.queue_issue_comment_realtime_event();
create trigger queue_issue_comment_realtime_on_update after update on app_private.comments
for each row execute function app_private.queue_issue_comment_realtime_event();
create trigger queue_issue_comment_realtime_on_delete after delete on app_private.comments
for each row execute function app_private.queue_issue_comment_realtime_event();
create trigger queue_announcement_realtime_on_insert after insert on app_private.announcements
for each row execute function app_private.queue_announcement_realtime_event();
create trigger queue_announcement_realtime_on_update after update on app_private.announcements
for each row execute function app_private.queue_announcement_realtime_event();
create trigger queue_announcement_realtime_on_delete after delete on app_private.announcements
for each row execute function app_private.queue_announcement_realtime_event();
create trigger queue_announcement_comment_realtime_on_insert after insert on app_private.announcement_comments
for each row execute function app_private.queue_announcement_comment_realtime_event();
create trigger queue_announcement_comment_realtime_on_update after update on app_private.announcement_comments
for each row execute function app_private.queue_announcement_comment_realtime_event();
create trigger queue_announcement_comment_realtime_on_delete after delete on app_private.announcement_comments
for each row execute function app_private.queue_announcement_comment_realtime_event();

drop policy if exists "read realtime events with valid firebase token" on app_private.realtime_events;
create policy "read authorized realtime events"
on app_private.realtime_events
for select
to authenticated
using (
  app_private.is_expected_firebase_project()
  and (
    audience = 'school'
    or recipient_uid = app_private.firebase_uid()
    or app_private.is_admin(app_private.firebase_uid())
  )
);

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

  select exists(
    select 1 from app_private.supports
    where supports.issue_id = backend_toggle_support.issue_id and uid = actor_uid
  ) into existing;
  if remove_support or existing then
    delete from app_private.supports
    where supports.issue_id = backend_toggle_support.issue_id and uid = actor_uid;
    supported := false;
  else
    insert into app_private.supports(issue_id, uid)
    values (backend_toggle_support.issue_id, actor_uid);
    supported := true;
  end if;

  select issues.support_count into next_count
  from app_private.issues where id = backend_toggle_support.issue_id;
  if supported and issue_record.support_goal is not null and next_count >= issue_record.support_goal then
    update app_private.issues
    set support_met_at = coalesce(support_met_at, now()),
        response_deadline_at = case
          when response_deadline_days is null then null
          else now() + make_interval(days => response_deadline_days)
        end
    where id = backend_toggle_support.issue_id and support_met_at is null;
    reached_goal := found;
  end if;

  if reached_goal then
    insert into app_private.outbox_events(event_type,target_type,target_id,actor_uid,payload)
    values (
      'support.goal_met', 'issue', issue_id::text, actor_uid,
      jsonb_build_object(
        'author_uid', issue_record.author_uid,
        'issue_category', issue_record.category,
        'new_support_count', next_count,
        'support_goal', issue_record.support_goal,
        'title', issue_record.title
      )
    );
  end if;
  support_count := next_count;
  goal_met := reached_goal;
  return next;
end;
$$;

create or replace function app_api.claim_outbox_events(batch_size integer default 25)
returns setof app_private.outbox_events
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  return query
  with claimed as (
    select id from app_private.outbox_events
    where attempt_count < 8
      and (
        (status in ('pending', 'failed') and next_attempt_at <= now())
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
    order by occurred_at asc
    limit greatest(1, least(batch_size, 25))
    for update skip locked
  )
  update app_private.outbox_events event
  set status = 'processing', attempt_count = event.attempt_count + 1,
      locked_at = now(), updated_at = now()
  from claimed where event.id = claimed.id returning event.*;
end;
$$;

create or replace function app_private.signal_outbox_worker()
returns trigger
language plpgsql
security definer
set search_path = app_private, extensions, public
as $$
declare
  worker_url text;
  webhook_secret text;
begin
  if current_setting('app.outbox_worker_signaled', true) = '1' then
    return null;
  end if;
  select value into worker_url from app_private.runtime_settings where key = 'outbox_worker_url';
  select value into webhook_secret from app_private.runtime_settings where key = 'webhook_secret';
  if worker_url is null or webhook_secret is null then
    return null;
  end if;
  perform set_config('app.outbox_worker_signaled', '1', true);
  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || webhook_secret),
    body := jsonb_build_object('signal', 'outbox_insert')
  );
  return null;
end;
$$;

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
  if current_setting('app.deletion_worker_signaled', true) = '1' then
    return null;
  end if;
  select value into worker_url from app_private.runtime_settings where key = 'deletion_worker_url';
  select value into webhook_secret from app_private.runtime_settings where key = 'webhook_secret';
  if worker_url is null or webhook_secret is null then
    return null;
  end if;
  perform set_config('app.deletion_worker_signaled', '1', true);
  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || webhook_secret),
    body := jsonb_build_object('signal', 'deletion_insert')
  );
  return null;
end;
$$;

create or replace function app_api.resignal_background_worker(worker_name text)
returns void
language plpgsql
security definer
set search_path = app_private, app_api, extensions, public
as $$
declare
  has_due_work boolean := false;
  worker_url text;
  webhook_secret text;
begin
  if worker_name = 'outbox' then
    select exists (
      select 1 from app_private.outbox_events
      where attempt_count < 8
        and (
          (status in ('pending', 'failed') and next_attempt_at <= now())
          or (status = 'processing' and locked_at < now() - interval '10 minutes')
        )
    ) into has_due_work;
    select value into worker_url from app_private.runtime_settings where key = 'outbox_worker_url';
  elsif worker_name = 'deletion' then
    select exists (
      select 1 from app_private.deletion_jobs
      where attempt_count < 8
        and (
          (status in ('pending', 'failed') and next_attempt_at <= now())
          or (status = 'processing' and locked_at < now() - interval '10 minutes')
        )
    ) into has_due_work;
    select value into worker_url from app_private.runtime_settings where key = 'deletion_worker_url';
  else
    raise exception 'unsupported-worker';
  end if;

  if not has_due_work or worker_url is null then
    return;
  end if;
  select value into webhook_secret from app_private.runtime_settings where key = 'webhook_secret';
  if webhook_secret is null then
    return;
  end if;
  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || webhook_secret),
    body := jsonb_build_object('signal', worker_name || '_backlog')
  );
end;
$$;

revoke all on function app_api.resignal_background_worker(text) from public, anon, authenticated;
grant execute on function app_api.resignal_background_worker(text) to service_role;

create or replace function app_private.signal_due_background_workers()
returns void
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
begin
  perform app_api.resignal_background_worker('outbox');
  perform app_api.resignal_background_worker('deletion');
end;
$$;

revoke all on function app_private.signal_due_background_workers() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'srp_retry_background_workers';
    perform cron.schedule(
      'srp_retry_background_workers',
      '* * * * *',
      'select app_private.signal_due_background_workers();'
    );
  end if;
end $$;

create or replace function app_api.claim_deletion_jobs(batch_size integer default 10)
returns setof app_private.deletion_jobs
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  return query
  with claimed as (
    select id from app_private.deletion_jobs
    where attempt_count < 8
      and (
        (status in ('pending', 'failed') and next_attempt_at <= now())
        or (status = 'processing' and locked_at < now() - interval '10 minutes')
      )
    order by created_at asc
    limit greatest(1, least(batch_size, 10))
    for update skip locked
  )
  update app_private.deletion_jobs job
  set status = 'processing', attempt_count = job.attempt_count + 1,
      locked_at = now(), updated_at = now()
  from claimed where job.id = claimed.id returning job.*;
end;
$$;

delete from app_private.push_delivery_logs where status = 'sent';

create or replace function app_private.minimize_maintenance_error()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
declare
  trace_code uuid;
begin
  if new.error is null
    or new.error ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then
    return new;
  end if;
  trace_code := gen_random_uuid();
  raise warning 'maintenance failure trace %, error %', trace_code, new.error;
  new.error := trace_code::text;
  return new;
end;
$$;

drop trigger if exists minimize_maintenance_insert_error on app_private.maintenance_runs;
create trigger minimize_maintenance_insert_error
before insert on app_private.maintenance_runs
for each row execute function app_private.minimize_maintenance_error();
drop trigger if exists minimize_maintenance_update_error on app_private.maintenance_runs;
create trigger minimize_maintenance_update_error
before update of error on app_private.maintenance_runs
for each row execute function app_private.minimize_maintenance_error();

revoke all on function app_private.minimize_maintenance_error() from public, anon, authenticated;

update app_private.maintenance_runs
set error = null
where error is not null
  and error !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
update app_private.outbox_events
set last_error = null
where last_error is not null
  and last_error !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
update app_private.deletion_jobs
set last_error = null
where last_error is not null
  and last_error !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
update app_private.push_delivery_logs
set error_message = null
where error_message is not null
  and error_message !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';
