-- Keep category availability as a live constraint while preserving explicit
-- per-issue closes. NULL means the issue follows its category.

alter table app_private.issues
  add column comments_override boolean;

update app_private.issues issue
set comments_override = case
  when not exists (
    select 1 from app_private.issue_categories category
    where category.id = issue.category and category.is_active and category.comments_enabled
  ) then null
  else issue.comments_enabled
end;

create or replace function app_private.enforce_issue_comment_availability()
returns trigger language plpgsql
set search_path = app_private, public as $$
declare category_comments_enabled boolean;
begin
  select category.comments_enabled and category.is_active
  into category_comments_enabled
  from app_private.issue_categories category
  where category.id = new.category;

  if new.status in ('completed', 'infeasible', 'review-rejected', 'auto-rejected') then
    if old.status in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
      and new.comments_enabled then
      raise exception 'comments-disabled';
    end if;
    new.comments_override := false;
    new.comments_enabled := false;
  elsif not coalesce(category_comments_enabled, false) then
    if new.comments_override is true and new.comments_override is distinct from old.comments_override then
      raise exception 'comments-disabled';
    end if;
    new.comments_enabled := false;
  else
    new.comments_enabled := coalesce(new.comments_override, true);
  end if;
  return new;
end;
$$;

create or replace function app_private.close_issue_comments_with_category()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  update app_private.issues issue
  set comments_enabled = case
    when new.comments_enabled then coalesce(issue.comments_override, true)
    else false
  end
  where issue.category = new.id;
  return null;
end;
$$;

create or replace function app_api.backend_set_issue_comments_enabled(
  issue_id uuid, actor_uid text, enabled boolean
)
returns jsonb language plpgsql security definer
set search_path = app_private, app_api, public as $$
declare issue_record app_private.issues%rowtype;
begin
  update app_private.issues issue
  set comments_override = backend_set_issue_comments_enabled.enabled,
      comments_enabled = backend_set_issue_comments_enabled.enabled,
      last_actor_uid = backend_set_issue_comments_enabled.actor_uid
  where issue.id = backend_set_issue_comments_enabled.issue_id
  returning issue.* into issue_record;
  if not found then raise exception 'not-found'; end if;
  return to_jsonb(issue_record);
end;
$$;
