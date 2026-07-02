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
  auth.is_expected_firebase_project()
  and (
    source = 'broadcast'
    or recipient_uid = auth.firebase_uid()
    or (source = 'admin' and app_private.is_admin(auth.firebase_uid()))
  )
);

create policy "read own notification state"
on app_private.notification_states
for select
to authenticated
using (auth.is_expected_firebase_project() and uid = auth.firebase_uid());

create or replace function app_private.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_issues_updated_at on app_private.issues;
create trigger touch_issues_updated_at
before update on app_private.issues
for each row execute function app_private.touch_updated_at();

drop trigger if exists touch_announcements_updated_at on app_private.announcements;
create trigger touch_announcements_updated_at
before update on app_private.announcements
for each row execute function app_private.touch_updated_at();
