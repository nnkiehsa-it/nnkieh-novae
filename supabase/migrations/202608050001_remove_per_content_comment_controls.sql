-- Remove per-record comment overrides. Comment availability now follows the
-- category/global setting and automatically closes for completed content.

drop trigger if exists enforce_issue_comment_availability on app_private.issues;
drop trigger if exists enforce_announcement_comment_availability on app_private.announcements;

drop function if exists app_api.backend_set_issue_comments_enabled(uuid, text, boolean);
drop function if exists app_api.backend_set_announcement_comments_enabled(uuid, text, boolean);

update app_private.issues issue
set comments_enabled = (
  issue.status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
  and exists (
    select 1
    from app_private.issue_categories category
    where category.id = issue.category
      and category.is_active
      and category.comments_enabled
  )
)
where issue.id is not null;

alter table app_private.issues drop column if exists comments_override;
alter table app_private.announcements drop column if exists comments_override;

create or replace function app_private.enforce_issue_comment_availability()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  new.comments_enabled := (
    new.status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
    and exists (
      select 1
      from app_private.issue_categories category
      where category.id = new.category
        and category.is_active
        and category.comments_enabled
    )
  );
  return new;
end;
$$;

create trigger enforce_issue_comment_availability
before insert or update of category, status on app_private.issues
for each row execute function app_private.enforce_issue_comment_availability();

create or replace function app_private.close_issue_comments_with_category()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  update app_private.issues issue
  set comments_enabled = (
    new.is_active
    and new.comments_enabled
    and issue.status not in ('completed', 'infeasible', 'review-rejected', 'auto-rejected')
  )
  where issue.category = new.id;
  return null;
end;
$$;

create or replace function app_private.enforce_announcement_comment_availability()
returns trigger language plpgsql
set search_path = app_private, public as $$
declare global_comments_enabled boolean;
begin
  select setup.announcement_comments_enabled
  into global_comments_enabled
  from app_private.system_setup setup
  where setup.singleton;
  new.comments_enabled := coalesce(global_comments_enabled, false);
  return new;
end;
$$;

create trigger enforce_announcement_comment_availability
before insert or update of comments_enabled on app_private.announcements
for each row execute function app_private.enforce_announcement_comment_availability();

create or replace function app_private.apply_announcement_comment_setting()
returns trigger language plpgsql
set search_path = app_private, public as $$
begin
  update app_private.announcements
  set comments_enabled = new.announcement_comments_enabled
  where id is not null;
  return null;
end;
$$;
