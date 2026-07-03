alter table app_private.issues
  add column if not exists author_name text not null default '匿名使用者',
  add column if not exists author_photo_url text,
  add column if not exists support_count integer not null default 0,
  add column if not exists support_enabled boolean not null default true,
  add column if not exists support_goal integer,
  add column if not exists support_deadline_at timestamptz,
  add column if not exists response_deadline_at timestamptz,
  add column if not exists support_met_at timestamptz,
  add column if not exists review_rejection_reason text,
  add column if not exists title_search text not null default '';

alter table app_private.comments
  add column if not exists author_name text not null default '匿名使用者',
  add column if not exists author_photo_url text,
  add column if not exists is_admin_comment boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table app_private.uploads
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists size_bytes integer,
  add column if not exists content_type text,
  add column if not exists delivery_type text not null default 'upload',
  add column if not exists resource_type text not null default 'image',
  add column if not exists secure_url text;

create table if not exists app_private.private_issue_authors (
  issue_id uuid primary key references app_private.issues(id) on delete cascade,
  author_uid text not null,
  author_name text not null default '匿名使用者',
  author_photo_url text,
  created_at timestamptz not null default now()
);

create table if not exists app_private.announcements (
  id uuid primary key default gen_random_uuid(),
  author_uid text not null,
  author_name text not null default '管理員',
  author_photo_url text,
  title text not null,
  content text not null,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz not null default now()
);

create table if not exists app_private.announcement_likes (
  announcement_id uuid not null references app_private.announcements(id) on delete cascade,
  uid text not null,
  created_at timestamptz not null default now(),
  primary key (announcement_id, uid)
);

create table if not exists app_private.announcement_comments (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references app_private.announcements(id) on delete cascade,
  author_uid text not null,
  author_name text not null default '匿名使用者',
  author_photo_url text,
  content text not null,
  is_admin_comment boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_private.notifications (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('broadcast', 'admin', 'user')),
  recipient_uid text,
  type text not null,
  target_type text not null check (target_type in ('announcement', 'issue')),
  target_id text not null,
  title text not null,
  actor_uid text,
  actor_name text,
  actor_photo_url text,
  body_preview text,
  issue_category text,
  old_status text,
  new_status text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table if not exists app_private.notification_states (
  uid text primary key,
  broadcast_opened_at timestamptz,
  admin_opened_at timestamptz,
  user_opened_at timestamptz,
  push_comments_enabled boolean not null default true,
  push_issue_updates_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists app_private.push_tokens (
  uid text not null,
  device_id text not null,
  token text not null,
  permission text not null,
  platform text not null,
  user_agent text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (uid, device_id)
);

create table if not exists app_private.user_profiles (
  uid text primary key,
  display_name text not null default '匿名使用者',
  photo_url text,
  cached_photo_url text,
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz
);

create table if not exists app_private.notion_pages (
  target_type text not null,
  target_id text not null,
  notion_page_id text not null,
  updated_at timestamptz not null default now(),
  primary key (target_type, target_id)
);

create table if not exists app_private.maintenance_runs (
  id uuid primary key default gen_random_uuid(),
  task_name text not null,
  status text not null default 'completed',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text
);

alter table app_private.private_issue_authors enable row level security;
alter table app_private.announcements enable row level security;
alter table app_private.announcement_likes enable row level security;
alter table app_private.announcement_comments enable row level security;
alter table app_private.notifications enable row level security;
alter table app_private.notification_states enable row level security;
alter table app_private.push_tokens enable row level security;
alter table app_private.user_profiles enable row level security;
alter table app_private.notion_pages enable row level security;
alter table app_private.maintenance_runs enable row level security;

create or replace view app_api.notifications
with (security_invoker = true)
as
select id, source, recipient_uid, type, target_type, target_id, title, created_at
from app_private.notifications;

create or replace view app_api.notification_states
with (security_invoker = true)
as
select uid, broadcast_opened_at, admin_opened_at, user_opened_at, updated_at
from app_private.notification_states;

grant select on app_api.notifications to authenticated;
grant select on app_api.notification_states to authenticated;

create policy "read notifications with valid firebase token"
on app_private.notifications
for select
to authenticated
using (
  app_private.is_expected_firebase_project()
  and (
    source = 'broadcast'
    or recipient_uid = app_private.firebase_uid()
    or (source = 'admin' and app_private.is_admin(app_private.firebase_uid()))
  )
);

create policy "read own notification state"
on app_private.notification_states
for select
to authenticated
using (app_private.is_expected_firebase_project() and uid = app_private.firebase_uid());

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function app_private.set_issue_derived_fields()
returns trigger
language plpgsql
as $$
begin
  new.title_search = lower(btrim(new.title));

  if new.support_goal is not null
    and new.support_count >= new.support_goal
    and new.support_met_at is null
  then
    new.support_met_at = now();
  end if;

  return new;
end;
$$;

create or replace function app_private.refresh_issue_support_count()
returns trigger
language plpgsql
as $$
declare
  changed_issue_id uuid := coalesce(new.issue_id, old.issue_id);
begin
  update app_private.issues
  set support_count = (
    select count(*)::integer
    from app_private.supports
    where supports.issue_id = changed_issue_id
  )
  where id = changed_issue_id;

  return null;
end;
$$;

create or replace function app_private.refresh_announcement_like_count()
returns trigger
language plpgsql
as $$
declare
  changed_announcement_id uuid := coalesce(new.announcement_id, old.announcement_id);
begin
  update app_private.announcements
  set like_count = (
    select count(*)::integer
    from app_private.announcement_likes
    where announcement_likes.announcement_id = changed_announcement_id
  )
  where id = changed_announcement_id;

  return null;
end;
$$;

create or replace function app_private.refresh_announcement_comment_count()
returns trigger
language plpgsql
as $$
declare
  changed_announcement_id uuid := coalesce(new.announcement_id, old.announcement_id);
begin
  update app_private.announcements
  set comment_count = (
    select count(*)::integer
    from app_private.announcement_comments
    where announcement_comments.announcement_id = changed_announcement_id
  )
  where id = changed_announcement_id;

  return null;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_support_count_non_negative'
      and conrelid = 'app_private.issues'::regclass
  ) then
    alter table app_private.issues
      add constraint issues_support_count_non_negative
      check (support_count >= 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'issues_support_goal_positive'
      and conrelid = 'app_private.issues'::regclass
  ) then
    alter table app_private.issues
      add constraint issues_support_goal_positive
      check (support_goal is null or support_goal > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'uploads_dimensions_non_negative'
      and conrelid = 'app_private.uploads'::regclass
  ) then
    alter table app_private.uploads
      add constraint uploads_dimensions_non_negative
      check (
        (width is null or width >= 0)
        and (height is null or height >= 0)
        and (size_bytes is null or size_bytes >= 0)
      )
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_title_not_blank'
      and conrelid = 'app_private.announcements'::regclass
  ) then
    alter table app_private.announcements
      add constraint announcements_title_not_blank
      check (length(btrim(title)) > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_content_not_blank'
      and conrelid = 'app_private.announcements'::regclass
  ) then
    alter table app_private.announcements
      add constraint announcements_content_not_blank
      check (length(btrim(content)) > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcement_comments_content_not_blank'
      and conrelid = 'app_private.announcement_comments'::regclass
  ) then
    alter table app_private.announcement_comments
      add constraint announcement_comments_content_not_blank
      check (length(btrim(content)) > 0)
      not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'announcements_counts_non_negative'
      and conrelid = 'app_private.announcements'::regclass
  ) then
    alter table app_private.announcements
      add constraint announcements_counts_non_negative
      check (like_count >= 0 and comment_count >= 0)
      not valid;
  end if;
end $$;

create index if not exists issues_title_search_trgm_idx
  on app_private.issues using gin (title_search extensions.gin_trgm_ops);

create index if not exists issues_category_status_support_idx
  on app_private.issues (category, status, support_count desc, created_at desc, id desc);

create index if not exists private_issue_authors_author_idx
  on app_private.private_issue_authors (author_uid, created_at desc);

create index if not exists announcements_published_idx
  on app_private.announcements (published_at desc, id desc);

create index if not exists announcements_like_idx
  on app_private.announcements (like_count desc, published_at desc, id desc);

create index if not exists announcements_comment_idx
  on app_private.announcements (comment_count desc, published_at desc, id desc);

create index if not exists announcement_comments_announcement_created_idx
  on app_private.announcement_comments (announcement_id, created_at asc, id asc);

create index if not exists announcement_likes_uid_announcement_idx
  on app_private.announcement_likes (uid, announcement_id);

create index if not exists notifications_source_created_idx
  on app_private.notifications (source, created_at desc, id desc);

create index if not exists notifications_recipient_source_created_idx
  on app_private.notifications (recipient_uid, source, created_at desc, id desc)
  where recipient_uid is not null;

create index if not exists push_tokens_token_idx
  on app_private.push_tokens (token);

create index if not exists maintenance_runs_task_started_idx
  on app_private.maintenance_runs (task_name, started_at desc);

drop trigger if exists touch_issues_updated_at on app_private.issues;
create trigger touch_issues_updated_at
before update on app_private.issues
for each row execute function app_private.touch_updated_at();

drop trigger if exists set_issue_derived_fields_on_write on app_private.issues;
create trigger set_issue_derived_fields_on_write
before insert or update of title, support_count, support_goal on app_private.issues
for each row execute function app_private.set_issue_derived_fields();

drop trigger if exists touch_announcements_updated_at on app_private.announcements;
create trigger touch_announcements_updated_at
before update on app_private.announcements
for each row execute function app_private.touch_updated_at();

drop trigger if exists touch_comments_updated_at on app_private.comments;
create trigger touch_comments_updated_at
before update on app_private.comments
for each row execute function app_private.touch_updated_at();

drop trigger if exists touch_announcement_comments_updated_at on app_private.announcement_comments;
create trigger touch_announcement_comments_updated_at
before update on app_private.announcement_comments
for each row execute function app_private.touch_updated_at();

drop trigger if exists refresh_issue_support_count_on_insert on app_private.supports;
create trigger refresh_issue_support_count_on_insert
after insert on app_private.supports
for each row execute function app_private.refresh_issue_support_count();

drop trigger if exists refresh_issue_support_count_on_delete on app_private.supports;
create trigger refresh_issue_support_count_on_delete
after delete on app_private.supports
for each row execute function app_private.refresh_issue_support_count();

drop trigger if exists refresh_announcement_like_count_on_insert on app_private.announcement_likes;
create trigger refresh_announcement_like_count_on_insert
after insert on app_private.announcement_likes
for each row execute function app_private.refresh_announcement_like_count();

drop trigger if exists refresh_announcement_like_count_on_delete on app_private.announcement_likes;
create trigger refresh_announcement_like_count_on_delete
after delete on app_private.announcement_likes
for each row execute function app_private.refresh_announcement_like_count();

drop trigger if exists refresh_announcement_comment_count_on_insert on app_private.announcement_comments;
create trigger refresh_announcement_comment_count_on_insert
after insert on app_private.announcement_comments
for each row execute function app_private.refresh_announcement_comment_count();

drop trigger if exists refresh_announcement_comment_count_on_delete on app_private.announcement_comments;
create trigger refresh_announcement_comment_count_on_delete
after delete on app_private.announcement_comments
for each row execute function app_private.refresh_announcement_comment_count();
