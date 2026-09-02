-- Forward bridge for populated databases entering 0016.
-- The canonical retention keys replace the legacy projection keys at the start
-- of 0016, so projection triggers must stop before its authoritative recounts.

do $$
begin
  -- Environments that already completed 0016 apply this newly introduced bridge
  -- afterward; the retired realtime table is the canonical cutover marker.
  if to_regclass('app_private.realtime_events') is null then
    return;
  end if;

  execute 'drop trigger if exists queue_issue_change_outbox on app_private.issues';
  execute 'drop trigger if exists queue_issue_realtime_on_insert on app_private.issues';
  execute 'drop trigger if exists queue_issue_realtime_on_update on app_private.issues';
  execute 'drop trigger if exists queue_issue_realtime_on_delete on app_private.issues';

  execute 'drop trigger if exists queue_issue_comment_realtime_on_insert on app_private.comments';
  execute 'drop trigger if exists queue_issue_comment_realtime_on_update on app_private.comments';
  execute 'drop trigger if exists queue_issue_comment_realtime_on_delete on app_private.comments';
  execute 'drop trigger if exists queue_comment_created_outbox on app_private.comments';

  execute 'drop trigger if exists queue_announcement_created_outbox on app_private.announcements';
  execute 'drop trigger if exists queue_announcement_updated_outbox on app_private.announcements';
  execute 'drop trigger if exists queue_announcement_deleted_outbox on app_private.announcements';
  execute 'drop trigger if exists queue_announcement_realtime_on_insert on app_private.announcements';
  execute 'drop trigger if exists queue_announcement_realtime_on_update on app_private.announcements';
  execute 'drop trigger if exists queue_announcement_realtime_on_delete on app_private.announcements';

  execute 'drop trigger if exists queue_announcement_comment_created_outbox on app_private.announcement_comments';
  execute 'drop trigger if exists queue_announcement_comment_realtime_on_insert on app_private.announcement_comments';
  execute 'drop trigger if exists queue_announcement_comment_realtime_on_update on app_private.announcement_comments';
  execute 'drop trigger if exists queue_announcement_comment_realtime_on_delete on app_private.announcement_comments';

  execute 'drop trigger if exists queue_facility_realtime_event on app_private.facility_reports';
  execute 'drop trigger if exists skip_identical_outbox_update on app_private.outbox_events';
  execute 'drop trigger if exists broadcast_notification_insert on app_private.notifications';
  execute 'drop trigger if exists broadcast_notification_state_change on app_private.notification_states';
end;
$$;
