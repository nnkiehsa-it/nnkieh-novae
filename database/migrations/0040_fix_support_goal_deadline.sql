-- Qualify the function argument in the goal-transition update. PostgreSQL
-- otherwise sees the argument and issues as equally valid references.
create or replace function app_api.backend_toggle_support(
  issue_id uuid,
  actor_uid text,
  remove_support boolean,
  response_deadline_days integer default null
)
returns table(supported boolean, support_count integer, goal_met boolean)
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  issue_record app_private.issues%rowtype;
  already_supported boolean;
  next_support_count integer;
  became_goal_met boolean := false;
begin
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;
  if not issue_record.support_enabled then raise exception 'support-disabled'; end if;

  select exists(
    select 1 from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and supports.uid = actor_uid
  ) into already_supported;

  if remove_support then
    if already_supported then
      delete from app_private.supports where supports.issue_id = backend_toggle_support.issue_id and supports.uid = actor_uid;
    end if;
  else
    if not already_supported then
      insert into app_private.supports(issue_id, uid) values (issue_id, actor_uid);
    end if;
  end if;

  select issues.support_count into next_support_count
  from app_private.issues where issues.id = backend_toggle_support.issue_id;

  if not remove_support and issue_record.support_goal is not null and next_support_count >= issue_record.support_goal and issue_record.support_met_at is null then
    became_goal_met := true;
    update app_private.issues
    set support_met_at = now(),
        status = case when status = 'pending' then 'processing' else status end,
        response_deadline_at = case
          when backend_toggle_support.response_deadline_days is not null then now() + make_interval(days => backend_toggle_support.response_deadline_days)
          else response_deadline_at
        end
    where id = issue_id;
  end if;

  return query select not remove_support, next_support_count, became_goal_met;
end;
$$;
