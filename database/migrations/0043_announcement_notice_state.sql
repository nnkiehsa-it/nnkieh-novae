-- Track announcement-list visits independently from the combined notification inbox.
-- Existing announcements are the rollout baseline and do not become new retroactively.

ALTER TABLE app_private.notification_states
  ADD COLUMN announcement_opened_at timestamptz NOT NULL DEFAULT now();

INSERT INTO app_private.notification_states(uid, announcement_opened_at)
SELECT profile.uid, now()
FROM app_private.user_profiles profile
ON CONFLICT (uid) DO NOTHING;

CREATE FUNCTION app_private.initialize_announcement_notice_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app_private', 'public'
AS $function$
begin
  insert into app_private.notification_states(uid)
  values (new.uid)
  on conflict (uid) do nothing;
  return new;
end;
$function$;

CREATE TRIGGER initialize_announcement_notice_state
AFTER INSERT ON app_private.user_profiles
FOR EACH ROW EXECUTE FUNCTION app_private.initialize_announcement_notice_state();

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
    'announcementOpenedAt', state_record.announcement_opened_at,
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
      'announcementOpenedAt', null,
      'broadcastOpenedAt', null,
      'adminOpenedAt', null,
      'userOpenedAt', null,
      'updatedAt', null
    )
  );
$function$;

CREATE FUNCTION app_api.backend_get_announcement_unread_hint(actor_uid text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'app_private', 'public'
AS $function$
  SELECT jsonb_build_object(
    'hasUnread', exists(
      SELECT 1
      FROM app_private.announcements announcement
      JOIN app_private.notification_states state_record
        ON state_record.uid = actor_uid
      WHERE announcement.published_at > state_record.announcement_opened_at
      LIMIT 1
    )
  );
$function$;

CREATE OR REPLACE FUNCTION app_api.backend_list_announcements_snapshot(
  actor_uid text,
  page_size integer,
  cursor_id uuid,
  cursor_published_at timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
  SELECT coalesce(app_api.backend_list_announcements(
    actor_uid, page_size, cursor_id, cursor_published_at
  ), '{}'::jsonb) || jsonb_build_object(
    'snapshotAt', (
      SELECT max(announcement.published_at)
      FROM app_private.announcements announcement
      WHERE cursor_id is null
        OR announcement.published_at < cursor_published_at
        OR (
          announcement.published_at = cursor_published_at
          AND announcement.id < cursor_id
        )
    ),
    'version', coalesce((
      SELECT version FROM app_private.content_versions WHERE domain = 'announcements'
    ), 1)
  );
$function$;

CREATE FUNCTION app_api.backend_mark_announcements_opened(
  actor_uid text,
  opened_through timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'app_private', 'app_api', 'public'
AS $function$
declare
  visible_through timestamptz;
  saved_opened_at timestamptz;
begin
  select max(announcement.published_at)
  into visible_through
  from app_private.announcements announcement
  where announcement.published_at <= least(opened_through, now());

  if visible_through is null then
    select announcement_opened_at into saved_opened_at
    from app_private.notification_states
    where uid = actor_uid;
    return jsonb_build_object(
      'success', true,
      'openedAt', saved_opened_at
    );
  end if;

  insert into app_private.notification_states(uid, announcement_opened_at, updated_at)
  values (actor_uid, visible_through, now())
  on conflict (uid) do update set
    announcement_opened_at = greatest(
      notification_states.announcement_opened_at,
      excluded.announcement_opened_at
    ),
    updated_at = excluded.updated_at
  returning announcement_opened_at into saved_opened_at;

  return jsonb_build_object(
    'success', true,
    'openedAt', saved_opened_at
  );
end;
$function$;

REVOKE ALL ON FUNCTION app_private.initialize_announcement_notice_state() FROM PUBLIC;
REVOKE ALL ON FUNCTION app_api.backend_get_announcement_unread_hint(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_api.backend_mark_announcements_opened(text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_api.backend_get_announcement_unread_hint(text) TO novae_runtime;
GRANT EXECUTE ON FUNCTION app_api.backend_mark_announcements_opened(text, timestamptz) TO novae_runtime;
