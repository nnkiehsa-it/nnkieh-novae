-- Add a live announcement-wide comment constraint while preserving explicit
-- per-announcement closes. NULL means the announcement follows the global setting.

alter table app_private.system_setup
  add column announcement_comments_enabled boolean not null default true;

alter table app_private.announcements
  add column comments_override boolean;

update app_private.announcements
set comments_override = case when comments_enabled then null else false end;

create or replace function app_private.enforce_announcement_comment_availability()
returns trigger language plpgsql
set search_path = app_private, public as $$
declare global_comments_enabled boolean;
begin
  select setup.announcement_comments_enabled
  into global_comments_enabled
  from app_private.system_setup setup
  where setup.singleton;

  if not coalesce(global_comments_enabled, false) then
    if tg_op = 'UPDATE'
      and new.comments_override is true
      and new.comments_override is distinct from old.comments_override then
      raise exception 'comments-disabled';
    end if;
    new.comments_enabled := false;
  else
    new.comments_enabled := coalesce(new.comments_override, true);
  end if;
  return new;
end;
$$;

create trigger enforce_announcement_comment_availability
before insert or update of comments_enabled, comments_override on app_private.announcements
for each row execute function app_private.enforce_announcement_comment_availability();

create or replace function app_private.apply_announcement_comment_setting()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  update app_private.announcements announcement
  set comments_enabled = case
    when new.announcement_comments_enabled then coalesce(announcement.comments_override, true)
    else false
  end
  where announcement.id is not null;
  return null;
end;
$$;

create trigger apply_announcement_comment_setting
after update of announcement_comments_enabled on app_private.system_setup
for each row
when (old.announcement_comments_enabled is distinct from new.announcement_comments_enabled)
execute function app_private.apply_announcement_comment_setting();

create or replace function app_private.prevent_announcement_comment_when_disabled()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  perform 1
  from app_private.announcements announcement
  cross join app_private.system_setup setup
  where announcement.id = new.announcement_id
    and announcement.comments_enabled
    and setup.singleton
    and setup.announcement_comments_enabled
  for share of announcement, setup;
  if not found then raise exception 'comments-disabled'; end if;
  return new;
end;
$$;

create or replace function app_api.backend_set_announcement_comments_enabled(
  announcement_id uuid, actor_uid text, enabled boolean
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare announcement_record app_private.announcements%rowtype;
begin
  update app_private.announcements announcement
  set comments_override = backend_set_announcement_comments_enabled.enabled,
      comments_enabled = backend_set_announcement_comments_enabled.enabled
  where announcement.id = backend_set_announcement_comments_enabled.announcement_id
  returning announcement.* into announcement_record;
  if not found then raise exception 'not-found'; end if;
  return app_api.backend_announcement_to_json(announcement_record, actor_uid);
end;
$$;

create or replace function app_api.backend_announcement_to_json(
  announcement_record app_private.announcements, actor_uid text
)
returns jsonb language plpgsql stable security definer
set search_path = app_private, app_api, public as $$
declare
  current_user_liked boolean;
  global_comments_enabled boolean;
begin
  select exists(
    select 1 from app_private.announcement_likes
    where announcement_id = announcement_record.id and uid = actor_uid
  ) into current_user_liked;
  select announcement_comments_enabled into global_comments_enabled
  from app_private.system_setup where singleton;
  return jsonb_build_object(
    'id', announcement_record.id,
    'author_uid', announcement_record.author_uid,
    'title', announcement_record.title,
    'content', announcement_record.content,
    'like_count', announcement_record.like_count,
    'comment_count', announcement_record.comment_count,
    'comments_enabled', announcement_record.comments_enabled,
    'comments_globally_enabled', coalesce(global_comments_enabled, false),
    'published_at', announcement_record.published_at,
    'published_at_ms', floor(extract(epoch from announcement_record.published_at) * 1000),
    'currentUserLiked', current_user_liked
  );
end;
$$;

create or replace function app_api.backend_list_announcements(
  actor_uid text, page_size integer, cursor_id uuid, cursor_published_at timestamptz
)
returns jsonb language sql stable security definer
set search_path = app_private, app_api, public as $$
  with settings as (
    select least(greatest(coalesce(page_size,30),1),50) as limited_page_size,
      coalesce((select announcement_comments_enabled from app_private.system_setup where singleton),false)
        as global_comments_enabled
  ), liked_ids as materialized (
    select announcement_id from app_private.announcement_likes where uid=actor_uid
  ), page_rows as materialized (
    select announcement.id,announcement.author_uid,announcement.title,
      announcement.like_count,announcement.comment_count,announcement.comments_enabled,
      (select global_comments_enabled from settings) as comments_globally_enabled,
      announcement.published_at,liked_ids.announcement_id is not null as current_user_liked
    from app_private.announcements announcement
    left join liked_ids on liked_ids.announcement_id=announcement.id
    where cursor_id is null or announcement.published_at<cursor_published_at
      or (announcement.published_at=cursor_published_at and announcement.id<cursor_id)
    order by announcement.published_at desc,announcement.id desc
    limit (select limited_page_size+1 from settings)
  ), limited_rows as (
    select * from page_rows order by published_at desc,id desc
    limit (select limited_page_size from settings)
  ), last_item as (
    select id,published_at from limited_rows order by published_at asc,id asc limit 1
  )
  select jsonb_build_object(
    'announcements',coalesce((select jsonb_agg(jsonb_build_object(
      'id',id,'author_uid',author_uid,'title',title,'like_count',like_count,
      'comment_count',comment_count,'comments_enabled',comments_enabled,
      'comments_globally_enabled',comments_globally_enabled,
      'published_at_ms',floor(extract(epoch from published_at)*1000),
      'currentUserLiked',current_user_liked
    ) order by published_at desc,id desc) from limited_rows),'[]'::jsonb),
    'hasMore',(select count(*)>(select limited_page_size from settings) from page_rows),
    'cursor',case when (select count(*)>(select limited_page_size from settings) from page_rows)
      then (select jsonb_build_object('id',id,'publishedAtMs',floor(extract(epoch from published_at)*1000)) from last_item)
      else null end
  );
$$;

create function app_private.update_announcement_comment_setting(
  actor_uid text, enabled boolean
)
returns void language plpgsql security definer
set search_path = app_private, public as $$
declare previous_enabled boolean;
begin
  select announcement_comments_enabled into previous_enabled
  from app_private.system_setup where singleton for update;
  update app_private.system_setup
  set announcement_comments_enabled = enabled, updated_at = now()
  where singleton;
  insert into app_private.category_configuration_audit(
    domain,operation,actor_uid,before_value,after_value
  ) values (
    'setup','update-features',actor_uid,
    jsonb_build_object('announcementCommentsEnabled',previous_enabled),
    jsonb_build_object('announcementCommentsEnabled',enabled)
  );
end;
$$;

create function app_api.backend_update_platform_features(
  actor_uid text,
  issues_enabled boolean,
  facilities_enabled boolean,
  announcement_comments_enabled boolean
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare result jsonb;
begin
  result := app_api.backend_update_platform_features(
    actor_uid, issues_enabled, facilities_enabled
  );
  perform app_private.update_announcement_comment_setting(
    actor_uid, announcement_comments_enabled
  );
  return result || jsonb_build_object(
    'announcementCommentsEnabled', announcement_comments_enabled
  );
end;
$$;

create function app_api.backend_save_category_management(
  actor_uid text,
  issue_categories jsonb,
  facility_categories jsonb,
  deleted_issue_category_ids text[],
  deleted_facility_category_ids text[],
  issues_enabled boolean,
  facilities_enabled boolean,
  announcement_comments_enabled boolean
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
begin
  perform app_api.backend_save_category_management(
    actor_uid,
    issue_categories,
    facility_categories,
    deleted_issue_category_ids,
    deleted_facility_category_ids,
    issues_enabled,
    facilities_enabled
  );
  perform app_private.update_announcement_comment_setting(
    actor_uid, announcement_comments_enabled
  );
  return jsonb_build_object('success', true);
end;
$$;

revoke all on function app_api.backend_update_platform_features(text,boolean,boolean,boolean)
from public,anon,authenticated;
revoke all on function app_private.update_announcement_comment_setting(text,boolean)
from public,anon,authenticated;
revoke all on function app_api.backend_save_category_management(
  text,jsonb,jsonb,text[],text[],boolean,boolean,boolean
) from public,anon,authenticated;
grant execute on function app_api.backend_update_platform_features(text,boolean,boolean,boolean)
to service_role;
grant execute on function app_api.backend_save_category_management(
  text,jsonb,jsonb,text[],text[],boolean,boolean,boolean
) to service_role;
