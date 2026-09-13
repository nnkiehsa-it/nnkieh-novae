-- Product limits live in runtime policy and are enforced by the Worker.
-- PostgreSQL keeps wider absolute bounds for storage and direct-write integrity.
create or replace function app_private.enforce_entry_input_limits()
returns trigger language plpgsql security definer
set search_path to 'app_private','public'
as $$
declare row_data jsonb := to_jsonb(new);
begin
  if tg_table_name in ('issues','announcements') then
    if char_length(btrim(coalesce(row_data->>'title',''))) not between 1 and 200
    then raise exception using errcode='23514',message='title-too-long'; end if;
    if app_private.visible_media_text_length(coalesce(row_data->>'content','')) > 10000
    then raise exception using errcode='23514',message='content-too-long'; end if;
  elsif tg_table_name in ('comments','announcement_comments') then
    if app_private.visible_media_text_length(coalesce(row_data->>'content','')) > 2000
    then raise exception using errcode='23514',message='comment-too-long'; end if;
  end if;
  return new;
end;
$$;
alter table app_private.facility_reports drop constraint facility_reports_title_check;
alter table app_private.facility_reports add constraint facility_reports_title_check
  check(length(btrim(title)) between 1 and 200);
alter table app_private.comments drop constraint comments_length_check;
alter table app_private.comments add constraint comments_length_check check(char_length(content) between 1 and 4000);
alter table app_private.announcement_comments drop constraint announcement_comments_length_check;
alter table app_private.announcement_comments add constraint announcement_comments_length_check check(char_length(content) between 1 and 4000);
alter table app_private.issues drop constraint issues_text_length_check;
alter table app_private.issues add constraint issues_text_length_check check(char_length(title) between 1 and 200 and char_length(content) between 1 and 14000);
alter table app_private.announcements drop constraint announcements_text_length_check;
alter table app_private.announcements add constraint announcements_text_length_check check(char_length(title) between 1 and 200 and char_length(content) between 1 and 14000);
alter table app_private.facility_reports drop constraint facility_reports_content_check;
alter table app_private.facility_reports add constraint facility_reports_content_check check(char_length(content) between 0 and 14000);
alter table app_private.facility_reports drop constraint facility_reports_location_check;
alter table app_private.facility_reports add constraint facility_reports_location_check check(char_length(btrim(location)) between 1 and 500);
