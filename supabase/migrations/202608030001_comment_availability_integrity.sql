-- Make comment availability authoritative across category, content, and status
-- boundaries. Existing comments remain readable; only new writes are blocked.

alter table app_private.announcements
  add column comments_enabled boolean not null default true;

create or replace function app_private.enforce_issue_comment_availability()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  if new.status in ('completed', 'infeasible', 'review-rejected', 'auto-rejected') then
    if old.status in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
      and new.comments_enabled then
      raise exception 'comments-disabled';
    end if;
    new.comments_enabled := false;
  elsif new.comments_enabled and not exists (
    select 1 from app_private.issue_categories category
    where category.id = new.category and category.is_active and category.comments_enabled
  ) then
    raise exception 'comments-disabled';
  end if;
  return new;
end;
$$;

create trigger enforce_issue_comment_availability
before update of comments_enabled, status on app_private.issues
for each row execute function app_private.enforce_issue_comment_availability();

create or replace function app_private.close_issue_comments_with_category()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  if old.comments_enabled and not new.comments_enabled then
    update app_private.issues set comments_enabled = false
    where category = new.id and comments_enabled;
  end if;
  return null;
end;
$$;

create trigger close_issue_comments_with_category
after update of comments_enabled on app_private.issue_categories
for each row execute function app_private.close_issue_comments_with_category();

update app_private.issues issue
set comments_enabled = false
where issue.comments_enabled and (
  issue.status in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
  or not exists (
    select 1 from app_private.issue_categories category
    where category.id = issue.category and category.is_active and category.comments_enabled
  )
);

create or replace function app_private.prevent_comment_when_disabled()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  perform 1
  from app_private.issues issue
  join app_private.issue_categories category on category.id = issue.category
  where issue.id = new.issue_id
    and issue.comments_enabled
    and category.is_active
    and category.comments_enabled
    and issue.status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
  for share of issue, category;
  if not found then raise exception 'comments-disabled'; end if;
  return new;
end;
$$;

create or replace function app_private.prevent_announcement_comment_when_disabled()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  perform 1 from app_private.announcements announcement
  where announcement.id = new.announcement_id and announcement.comments_enabled
  for share;
  if not found then raise exception 'comments-disabled'; end if;
  return new;
end;
$$;

create trigger prevent_announcement_comment_when_disabled
before insert on app_private.announcement_comments
for each row execute function app_private.prevent_announcement_comment_when_disabled();

create or replace function app_api.backend_set_issue_comments_enabled(
  issue_id uuid, actor_uid text, enabled boolean
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare issue_record app_private.issues%rowtype;
begin
  update app_private.issues issue
  set comments_enabled = backend_set_issue_comments_enabled.enabled,
      last_actor_uid = backend_set_issue_comments_enabled.actor_uid
  where issue.id = backend_set_issue_comments_enabled.issue_id
  returning issue.* into issue_record;
  if not found then raise exception 'not-found'; end if;
  return to_jsonb(issue_record);
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
  set comments_enabled = backend_set_announcement_comments_enabled.enabled
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
declare current_user_liked boolean;
begin
  select exists(
    select 1 from app_private.announcement_likes
    where announcement_id = announcement_record.id and uid = actor_uid
  ) into current_user_liked;
  return jsonb_build_object(
    'id', announcement_record.id,
    'author_uid', announcement_record.author_uid,
    'title', announcement_record.title,
    'content', announcement_record.content,
    'like_count', announcement_record.like_count,
    'comment_count', announcement_record.comment_count,
    'comments_enabled', announcement_record.comments_enabled,
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
    select least(greatest(coalesce(page_size,30),1),50) as limited_page_size
  ), liked_ids as materialized (
    select announcement_id from app_private.announcement_likes where uid=actor_uid
  ), page_rows as materialized (
    select announcement.id,announcement.author_uid,announcement.title,
      announcement.like_count,announcement.comment_count,announcement.comments_enabled,
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
      'published_at_ms',floor(extract(epoch from published_at)*1000),
      'currentUserLiked',current_user_liked
    ) order by published_at desc,id desc) from limited_rows),'[]'::jsonb),
    'hasMore',(select count(*)>(select limited_page_size from settings) from page_rows),
    'cursor',case when (select count(*)>(select limited_page_size from settings) from page_rows)
      then (select jsonb_build_object('id',id,'publishedAtMs',floor(extract(epoch from published_at)*1000)) from last_item)
      else null end
  );
$$;

revoke all on function app_api.backend_set_issue_comments_enabled(uuid,text,boolean)
from public,anon,authenticated;
revoke all on function app_api.backend_set_announcement_comments_enabled(uuid,text,boolean)
from public,anon,authenticated;
grant execute on function app_api.backend_set_issue_comments_enabled(uuid,text,boolean) to service_role;
grant execute on function app_api.backend_set_announcement_comments_enabled(uuid,text,boolean) to service_role;
