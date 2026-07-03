create schema if not exists app_private;
create schema if not exists app_api;

create extension if not exists pg_net with schema extensions;

grant usage on schema app_api to anon, authenticated;
grant usage on schema app_private to service_role;

-- Architectural helper test placeholders: auth.firebase_uid() and auth.firebase_project_id()

create or replace function app_private.firebase_uid()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::text;
$$;

create or replace function app_private.firebase_project_id()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'aud', '')::text;
$$;

create or replace function app_private.is_expected_firebase_project()
returns boolean
language sql
stable
as $$
  select app_private.firebase_project_id() = nullif(current_setting('app.firebase_project_id', true), '');
$$;

grant execute on function app_private.firebase_uid() to authenticated, anon, service_role;
grant execute on function app_private.firebase_project_id() to authenticated, anon, service_role;
grant execute on function app_private.is_expected_firebase_project() to authenticated, anon, service_role;

create table if not exists app_private.user_roles (
  uid text primary key,
  role text not null check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.issues (
  id uuid primary key default gen_random_uuid(),
  author_uid text not null,
  title text not null,
  content text not null,
  status text not null,
  category text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.comments (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid not null references app_private.issues(id) on delete cascade,
  author_uid text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_private.supports (
  issue_id uuid not null references app_private.issues(id) on delete cascade,
  uid text not null,
  created_at timestamptz not null default now(),
  primary key (issue_id, uid)
);

create table if not exists app_private.uploads (
  id uuid primary key default gen_random_uuid(),
  owner_uid text not null,
  cloudinary_public_id text not null,
  status text not null check (status in ('pending', 'ready', 'attached', 'failed')),
  visibility text not null check (visibility in ('public', 'private', 'authenticated')),
  attached_target_type text,
  attached_target_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours'
);

create table if not exists app_private.deletion_jobs (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,
  target_id text not null,
  cloudinary_public_id text,
  notion_page_id text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.outbox_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  target_type text not null,
  target_id text not null,
  actor_uid text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  locked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

alter table app_private.user_roles enable row level security;
alter table app_private.issues enable row level security;
alter table app_private.comments enable row level security;
alter table app_private.supports enable row level security;
alter table app_private.uploads enable row level security;
alter table app_private.deletion_jobs enable row level security;
alter table app_private.outbox_events enable row level security;

create or replace function app_private.is_admin(uid text default app_private.firebase_uid())
returns boolean
language sql
stable
security definer
set search_path = app_private, public
as $$
  select exists (
    select 1
    from app_private.user_roles
    where user_roles.uid = is_admin.uid
      and role = 'admin'
  );
$$;

create or replace view app_api.issues
with (security_invoker = true)
as
select
  id,
  title,
  content,
  status,
  category,
  created_at,
  updated_at
from app_private.issues;

grant select on app_api.issues to anon, authenticated;

create policy "read issues with valid firebase token"
on app_private.issues
for select
to authenticated
using (app_private.is_expected_firebase_project());

create policy "read comments with valid firebase token"
on app_private.comments
for select
to authenticated
using (app_private.is_expected_firebase_project());

create policy "read own supports"
on app_private.supports
for select
to authenticated
using (app_private.is_expected_firebase_project() and uid = app_private.firebase_uid());

create policy "read own uploads"
on app_private.uploads
for select
to authenticated
using (app_private.is_expected_firebase_project() and owner_uid = app_private.firebase_uid());

create or replace function app_api.delete_issue(issue_id uuid)
returns void
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  issue_record app_private.issues%rowtype;
  actor_uid text := app_private.firebase_uid();
begin
  if not app_private.is_expected_firebase_project() or actor_uid is null then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  select *
  into issue_record
  from app_private.issues
  where id = delete_issue.issue_id
  for update;

  if not found then
    return;
  end if;

  if issue_record.author_uid <> actor_uid and not app_private.is_admin(actor_uid) then
    raise exception 'permission denied' using errcode = '42501';
  end if;

  insert into app_private.outbox_events (
    event_type,
    target_type,
    target_id,
    actor_uid,
    payload
  )
  values (
    'issue.deleted',
    'issue',
    issue_record.id::text,
    actor_uid,
    jsonb_build_object('issue_id', issue_record.id::text)
  );

  delete from app_private.issues
  where id = issue_record.id;
end;
$$;

grant execute on function app_api.delete_issue(uuid) to authenticated;

create or replace function app_api.claim_outbox_events(batch_size integer default 100)
returns setof app_private.outbox_events
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  return query
  with claimed as (
    select id
    from app_private.outbox_events
    where status in ('pending', 'failed')
      and next_attempt_at <= now()
    order by occurred_at asc
    limit greatest(1, least(batch_size, 100))
    for update skip locked
  )
  update app_private.outbox_events event
  set
    status = 'processing',
    attempt_count = event.attempt_count + 1,
    locked_at = now(),
    updated_at = now()
  from claimed
  where event.id = claimed.id
  returning event.*;
end;
$$;

create or replace function app_api.complete_outbox_event(event_id uuid)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.outbox_events
  set
    status = 'completed',
    updated_at = now(),
    expires_at = now() + interval '2 days'
  where id = event_id;
$$;

create or replace function app_api.fail_outbox_event(event_id uuid, error_message text)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.outbox_events
  set
    status = 'failed',
    last_error = left(error_message, 1000),
    next_attempt_at = now() + make_interval(mins => least(60, greatest(1, attempt_count * 2))),
    updated_at = now()
  where id = event_id;
$$;

grant execute on function app_api.claim_outbox_events(integer) to service_role;
grant execute on function app_api.complete_outbox_event(uuid) to service_role;
grant execute on function app_api.fail_outbox_event(uuid, text) to service_role;

create or replace function app_api.claim_deletion_jobs(batch_size integer default 50)
returns setof app_private.deletion_jobs
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  return query
  with claimed as (
    select id
    from app_private.deletion_jobs
    where status in ('pending', 'failed')
      and next_attempt_at <= now()
    order by created_at asc
    limit greatest(1, least(batch_size, 50))
    for update skip locked
  )
  update app_private.deletion_jobs job
  set
    status = 'processing',
    attempt_count = job.attempt_count + 1,
    updated_at = now()
  from claimed
  where job.id = claimed.id
  returning job.*;
end;
$$;

create or replace function app_api.complete_deletion_job(job_id uuid)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.deletion_jobs
  set
    status = 'completed',
    updated_at = now()
  where id = job_id;
$$;

create or replace function app_api.fail_deletion_job(job_id uuid, error_message text)
returns void
language sql
security definer
set search_path = app_private, public
as $$
  update app_private.deletion_jobs
  set
    status = 'failed',
    last_error = left(error_message, 1000),
    next_attempt_at = now() + make_interval(mins => least(60, greatest(1, attempt_count * 2))),
    updated_at = now()
  where id = job_id;
$$;

grant execute on function app_api.claim_deletion_jobs(integer) to service_role;
grant execute on function app_api.complete_deletion_job(uuid) to service_role;
grant execute on function app_api.fail_deletion_job(uuid, text) to service_role;

create or replace function app_private.signal_outbox_worker()
returns trigger
language plpgsql
security definer
set search_path = app_private, extensions, public
as $$
declare
  worker_url text := nullif(current_setting('app.outbox_worker_url', true), '');
  webhook_secret text := nullif(current_setting('app.webhook_secret', true), '');
begin
  if worker_url is null or webhook_secret is null then
    return null;
  end if;

  perform net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Authorization', 'Bearer ' || webhook_secret),
    body := jsonb_build_object('signal', 'outbox_insert')
  );

  return null;
end;
$$;

drop trigger if exists outbox_worker_wakeup on app_private.outbox_events;
create trigger outbox_worker_wakeup
after insert on app_private.outbox_events
for each statement
execute function app_private.signal_outbox_worker();
