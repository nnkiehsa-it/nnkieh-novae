do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_tokens_device_id_not_blank'
      and conrelid = 'app_private.push_tokens'::regclass
  ) then
    alter table app_private.push_tokens
      add constraint push_tokens_device_id_not_blank
      check (length(btrim(device_id)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_tokens_token_not_blank'
      and conrelid = 'app_private.push_tokens'::regclass
  ) then
    alter table app_private.push_tokens
      add constraint push_tokens_token_not_blank
      check (length(btrim(token)) > 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_tokens_permission_check'
      and conrelid = 'app_private.push_tokens'::regclass
  ) then
    alter table app_private.push_tokens
      add constraint push_tokens_permission_check
      check (permission in ('default', 'denied', 'granted'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'push_tokens_length_check'
      and conrelid = 'app_private.push_tokens'::regclass
  ) then
    alter table app_private.push_tokens
      add constraint push_tokens_length_check
      check (
        char_length(device_id) <= 160
        and char_length(token) <= 4096
        and char_length(platform) <= 120
        and char_length(user_agent) <= 512
      );
  end if;
end $$;

alter table app_private.issues validate constraint issues_status_check;
alter table app_private.issues validate constraint issues_title_not_blank;
alter table app_private.issues validate constraint issues_content_not_blank;
alter table app_private.issues validate constraint issues_support_count_non_negative;
alter table app_private.issues validate constraint issues_support_goal_positive;
alter table app_private.comments validate constraint comments_content_not_blank;
alter table app_private.uploads validate constraint uploads_dimensions_non_negative;
alter table app_private.announcements validate constraint announcements_title_not_blank;
alter table app_private.announcements validate constraint announcements_content_not_blank;
alter table app_private.announcements validate constraint announcements_counts_non_negative;
alter table app_private.announcement_comments validate constraint announcement_comments_content_not_blank;
