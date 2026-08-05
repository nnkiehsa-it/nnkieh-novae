alter table app_private.content_revisions rename to content_versions;
alter table app_private.content_versions rename column revision to version;

drop trigger if exists bump_issue_content_revision on app_private.issues;
drop trigger if exists bump_issue_comment_content_revision on app_private.comments;
drop trigger if exists bump_announcement_content_revision on app_private.announcements;
drop trigger if exists bump_announcement_comment_content_revision on app_private.announcement_comments;
drop trigger if exists bump_facility_content_revision on app_private.facility_reports;

create or replace function app_private.bump_content_version()
returns trigger
language plpgsql
security definer
set search_path = app_private, public
as $$
begin
  insert into app_private.content_versions(domain, version, updated_at)
  values (tg_argv[0], 2, now())
  on conflict (domain) do update
  set version = content_versions.version + 1,
      updated_at = excluded.updated_at;
  return null;
end;
$$;

revoke all on function app_private.bump_content_version() from public, anon, authenticated;

-- Increment before row-level realtime triggers so every event carries the
-- version of the transaction that produced it.
create trigger bump_issue_content_version
before insert or update or delete on app_private.issues
for each statement execute function app_private.bump_content_version('issues');

create trigger bump_issue_comment_content_version
before insert or update or delete on app_private.comments
for each statement execute function app_private.bump_content_version('issues');

create trigger bump_announcement_content_version
before insert or update or delete on app_private.announcements
for each statement execute function app_private.bump_content_version('announcements');

create trigger bump_announcement_comment_content_version
before insert or update or delete on app_private.announcement_comments
for each statement execute function app_private.bump_content_version('announcements');

create trigger bump_facility_content_version
before insert or update or delete on app_private.facility_reports
for each statement execute function app_private.bump_content_version('facilities');

alter table app_private.content_versions
  drop constraint if exists content_revisions_domain_check;
alter table app_private.content_versions
  add constraint content_versions_domain_check check (domain in ('issues', 'announcements', 'facilities'));

create or replace function app_private.emit_content_realtime_event(
  event_type text,
  target_type text,
  target_id text,
  parent_id text,
  category text,
  audience text,
  recipient_uid text,
  support_count integer,
  like_count integer,
  comment_count integer,
  op text
)
returns void
language plpgsql
security definer
set search_path = app_private, realtime, public
as $$
declare
  event_payload jsonb;
  event_domain text := case
    when event_type like 'issue_%' then 'issues'
    when event_type like 'announcement_%' then 'announcements'
    when event_type = 'facility_changed' then 'facilities'
    else null
  end;
  event_version bigint;
begin
  select version into event_version
  from app_private.content_versions
  where domain = event_domain;

  event_payload := jsonb_build_object(
    'event_type', emit_content_realtime_event.event_type,
    'target_type', emit_content_realtime_event.target_type,
    'target_id', emit_content_realtime_event.target_id,
    'parent_id', emit_content_realtime_event.parent_id,
    'category', emit_content_realtime_event.category,
    'support_count', emit_content_realtime_event.support_count,
    'like_count', emit_content_realtime_event.like_count,
    'comment_count', emit_content_realtime_event.comment_count,
    'op', emit_content_realtime_event.op,
    'version', coalesce(event_version, 1),
    'created_at', now()
  );

  if emit_content_realtime_event.audience = 'school' then
    perform realtime.send(event_payload, 'content_changed', 'content:school', true);
    return;
  end if;
  if coalesce(emit_content_realtime_event.recipient_uid, '') <> '' then
    perform realtime.send(event_payload, 'content_changed', 'content:user:' || emit_content_realtime_event.recipient_uid, true);
  end if;
  perform realtime.send(event_payload, 'content_changed', 'content:admin', true);
end;
$$;

revoke all on function app_private.emit_content_realtime_event(
  text,text,text,text,text,text,text,integer,integer,integer,text
) from public, anon, authenticated;
