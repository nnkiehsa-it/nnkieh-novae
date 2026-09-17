-- Ordinary members always receive every applicable notification once push is enabled.
-- Platform administrators opt in separately to proposal, facility, and comment notifications.

CREATE TABLE app_private.platform_admin_notification_preferences (
  uid text PRIMARY KEY REFERENCES app_private.user_profiles(uid) ON DELETE CASCADE,
  issue_notifications_enabled boolean NOT NULL DEFAULT false,
  facility_notifications_enabled boolean NOT NULL DEFAULT false,
  comment_notifications_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE app_private.platform_admin_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP FUNCTION app_api.backend_update_push_notification_preferences(text, boolean, boolean, text, text);
DROP FUNCTION app_api.backend_update_push_notification_preferences(text, boolean, boolean, boolean, text, text);
DROP FUNCTION app_api.backend_unregister_push_token(text, text, text);

CREATE OR REPLACE FUNCTION app_api.backend_notification_state_to_json(
  state_record app_private.notification_states
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
  SELECT jsonb_build_object(
    'uid', state_record.uid,
    'broadcastOpenedAt', state_record.broadcast_opened_at,
    'adminOpenedAt', state_record.admin_opened_at,
    'userOpenedAt', state_record.user_opened_at,
    'updatedAt', state_record.updated_at
  );
$function$;

CREATE OR REPLACE FUNCTION app_api.backend_get_notification_read_state(actor_uid text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
  SELECT coalesce(
    (
      SELECT app_api.backend_notification_state_to_json(state_record)
      FROM app_private.notification_states state_record
      WHERE state_record.uid = actor_uid
    ),
    jsonb_build_object(
      'uid', actor_uid,
      'broadcastOpenedAt', null,
      'adminOpenedAt', null,
      'userOpenedAt', null,
      'updatedAt', null
    )
  );
$function$;

CREATE OR REPLACE FUNCTION app_api.backend_push_notification_preference(
  actor_uid text,
  device_id text,
  permission text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  token_count integer;
  device_enabled boolean := false;
begin
  if coalesce(device_id, '') <> '' then
    select exists(
      select 1 from app_private.push_tokens
      where uid = actor_uid
        and push_tokens.device_id = backend_push_notification_preference.device_id
    ) into device_enabled;
  end if;
  select count(*) into token_count from app_private.push_tokens where uid = actor_uid;
  return jsonb_build_object(
    'deviceEnabled', device_enabled,
    'enabled', token_count > 0,
    'permission', coalesce(permission, 'default'),
    'tokenCount', token_count
  );
end;
$function$;

ALTER TABLE app_private.notification_states
  DROP COLUMN push_comments_enabled,
  DROP COLUMN push_issue_updates_enabled,
  DROP COLUMN push_facility_updates_enabled;

CREATE FUNCTION app_api.backend_get_platform_admin_notification_preferences(actor_uid text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  preferences app_private.platform_admin_notification_preferences%rowtype;
begin
  if not exists (
    select 1 from app_private.user_role_assignments
    where uid = actor_uid and role_code = 'platform-admin'
  ) then
    raise exception 'permission-denied';
  end if;

  select * into preferences
  from app_private.platform_admin_notification_preferences
  where uid = actor_uid;

  return jsonb_build_object(
    'issueNotifications', coalesce(preferences.issue_notifications_enabled, false),
    'facilityNotifications', coalesce(preferences.facility_notifications_enabled, false),
    'commentNotifications', coalesce(preferences.comment_notifications_enabled, false)
  );
end;
$function$;

CREATE FUNCTION app_api.backend_update_platform_admin_notification_preferences(
  actor_uid text,
  issue_notifications_enabled boolean,
  facility_notifications_enabled boolean,
  comment_notifications_enabled boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
begin
  if not exists (
    select 1 from app_private.user_role_assignments
    where uid = actor_uid and role_code = 'platform-admin'
  ) then
    raise exception 'permission-denied';
  end if;

  insert into app_private.platform_admin_notification_preferences(
    uid,
    issue_notifications_enabled,
    facility_notifications_enabled,
    comment_notifications_enabled,
    updated_at
  ) values (
    actor_uid,
    issue_notifications_enabled,
    facility_notifications_enabled,
    comment_notifications_enabled,
    now()
  )
  on conflict(uid) do update set
    issue_notifications_enabled = excluded.issue_notifications_enabled,
    facility_notifications_enabled = excluded.facility_notifications_enabled,
    comment_notifications_enabled = excluded.comment_notifications_enabled,
    updated_at = excluded.updated_at;

  return app_api.backend_get_platform_admin_notification_preferences(actor_uid);
end;
$function$;

CREATE FUNCTION app_api.backend_platform_admin_notification_recipients(notification_kind text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
begin
  if notification_kind not in ('issue', 'facility', 'comment') then
    raise exception 'validation-invalid';
  end if;

  return jsonb_build_object(
    'adminUids', coalesce((
      select jsonb_agg(assignment.uid order by assignment.uid)
      from app_private.user_role_assignments assignment
      where assignment.role_code = 'platform-admin'
    ), '[]'::jsonb),
    'enabledUids', coalesce((
      select jsonb_agg(assignment.uid order by assignment.uid)
      from app_private.user_role_assignments assignment
      join app_private.platform_admin_notification_preferences preferences
        on preferences.uid = assignment.uid
      where assignment.role_code = 'platform-admin'
        and case notification_kind
          when 'issue' then preferences.issue_notifications_enabled
          when 'facility' then preferences.facility_notifications_enabled
          else preferences.comment_notifications_enabled
        end
    ), '[]'::jsonb)
  );
end;
$function$;

REVOKE ALL ON TABLE app_private.platform_admin_notification_preferences FROM PUBLIC;
REVOKE ALL ON FUNCTION app_api.backend_get_platform_admin_notification_preferences(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_api.backend_update_platform_admin_notification_preferences(text, boolean, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_api.backend_platform_admin_notification_recipients(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_api.backend_get_platform_admin_notification_preferences(text) TO novae_runtime;
GRANT EXECUTE ON FUNCTION app_api.backend_update_platform_admin_notification_preferences(text, boolean, boolean, boolean) TO novae_runtime;
GRANT EXECUTE ON FUNCTION app_api.backend_platform_admin_notification_recipients(text) TO novae_runtime;
