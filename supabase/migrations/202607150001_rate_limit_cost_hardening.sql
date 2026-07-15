-- Move client invalidations to authorized Broadcast topics so authenticated
-- clients no longer need direct Data API SELECT privileges on private tables.

revoke select on app_api.notifications from authenticated;
revoke select on app_api.notification_states from authenticated;
revoke select on app_private.notifications from authenticated;
revoke select on app_private.notification_states from authenticated;
revoke select on app_private.realtime_events from authenticated;

drop policy if exists "read notifications with valid firebase token"
  on app_private.notifications;
drop policy if exists "read own notification state"
  on app_private.notification_states;
drop policy if exists "read authorized realtime events"
  on app_private.realtime_events;

do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'app_private' and tablename = 'realtime_events') then
    alter publication supabase_realtime drop table app_private.realtime_events;
  end if;
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'app_private' and tablename = 'notifications') then
    alter publication supabase_realtime drop table app_private.notifications;
  end if;
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'app_private' and tablename = 'notification_states') then
    alter publication supabase_realtime drop table app_private.notification_states;
  end if;
end $$;

drop policy if exists "authenticated can receive content broadcasts"
  on realtime.messages;
create policy "authenticated can receive content broadcasts"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and app_private.is_expected_firebase_project()
  and (
    realtime.topic() = 'content:school'
    or realtime.topic() = 'content:user:' || app_private.firebase_uid()
    or (
      realtime.topic() = 'content:admin'
      and app_private.is_admin(app_private.firebase_uid())
    )
    or realtime.topic() = 'notifications:broadcast'
    or realtime.topic() = 'notifications:user:' || app_private.firebase_uid()
    or realtime.topic() = 'notification-state:' || app_private.firebase_uid()
    or (
      realtime.topic() = 'notifications:admin'
      and app_private.is_admin(app_private.firebase_uid())
    )
  )
);

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
begin
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
    'created_at', now()
  );

  if emit_content_realtime_event.audience = 'school' then
    perform realtime.send(event_payload, 'content_changed', 'content:school', true);
    return;
  end if;

  if coalesce(emit_content_realtime_event.recipient_uid, '') <> '' then
    perform realtime.send(
      event_payload,
      'content_changed',
      'content:user:' || emit_content_realtime_event.recipient_uid,
      true
    );
  end if;
  perform realtime.send(event_payload, 'content_changed', 'content:admin', true);
end;
$$;

revoke all on function app_private.emit_content_realtime_event(
  text,text,text,text,text,text,text,integer,integer,integer,text
) from public, anon, authenticated;

create or replace function app_private.broadcast_notification_insert()
returns trigger
language plpgsql
security definer
set search_path = app_private, realtime, public
as $$
declare
  topic text;
begin
  topic := case new.source
    when 'broadcast' then 'notifications:broadcast'
    when 'admin' then 'notifications:admin'
    when 'user' then 'notifications:user:' || coalesce(new.recipient_uid, '')
    else null
  end;
  if topic is not null and topic not like '%:' then
    perform realtime.send(to_jsonb(new), 'notification_insert', topic, true);
  end if;
  return null;
end;
$$;

create or replace function app_private.broadcast_notification_state_change()
returns trigger
language plpgsql
security definer
set search_path = app_private, realtime, public
as $$
begin
  perform realtime.send(
    to_jsonb(new),
    'notification_state_changed',
    'notification-state:' || new.uid,
    true
  );
  return null;
end;
$$;

drop trigger if exists broadcast_notification_insert on app_private.notifications;
create trigger broadcast_notification_insert
after insert on app_private.notifications
for each row execute function app_private.broadcast_notification_insert();

drop trigger if exists broadcast_notification_state_change on app_private.notification_states;
create trigger broadcast_notification_state_change
after insert or update on app_private.notification_states
for each row execute function app_private.broadcast_notification_state_change();

revoke all on function app_private.broadcast_notification_insert()
  from public, anon, authenticated;
revoke all on function app_private.broadcast_notification_state_change()
  from public, anon, authenticated;

-- Keep personal FCM fan-out bounded. Existing devices may refresh their token,
-- but a new device cannot grow the recipient beyond ten active rows.
create or replace function app_api.backend_register_push_token(
  actor_uid text,
  device_id text,
  token text,
  permission text,
  platform text,
  user_agent text
)
returns jsonb
language plpgsql
security definer
set search_path = app_private, app_api, public
as $$
declare
  max_devices constant integer := 10;
begin
  perform pg_advisory_xact_lock(hashtextextended(backend_register_push_token.actor_uid, 0));
  if not exists (
    select 1
    from app_private.push_tokens
    where push_tokens.uid = backend_register_push_token.actor_uid
      and push_tokens.device_id = backend_register_push_token.device_id
  ) and (
    select count(*)
    from app_private.push_tokens
    where push_tokens.uid = backend_register_push_token.actor_uid
  ) >= max_devices then
    raise exception 'push-token-limit-reached';
  end if;

  insert into app_private.push_tokens(uid, device_id, token, permission, platform, user_agent, updated_at)
  values (
    backend_register_push_token.actor_uid,
    backend_register_push_token.device_id,
    backend_register_push_token.token,
    coalesce(backend_register_push_token.permission, 'default'),
    backend_register_push_token.platform,
    backend_register_push_token.user_agent,
    now()
  )
  on conflict on constraint push_tokens_pkey do update
  set token = excluded.token,
      permission = excluded.permission,
      platform = excluded.platform,
      user_agent = excluded.user_agent,
      updated_at = excluded.updated_at;

  return app_api.backend_push_notification_preference(
    backend_register_push_token.actor_uid,
    backend_register_push_token.device_id,
    backend_register_push_token.permission
  );
end;
$$;

revoke all on function app_api.backend_register_push_token(text,text,text,text,text,text)
  from public, anon, authenticated;
grant execute on function app_api.backend_register_push_token(text,text,text,text,text,text)
  to service_role;
