-- The author's own support is part of a proposal's count.
--
-- `app_private.refresh_issue_support_count` and `backend_create_issue` have
-- always counted the author's implicit support: a proposal that asks for
-- support starts at one and the trigger recomputes it as one plus the rows in
-- `app_private.supports`. `backend_toggle_support` disagreed — it overwrote the
-- column with the bare row count — so every proposal lost the author the first
-- time anyone else supported it, and dropped to zero when that supporter
-- withdrew. The trigger is the one place that owns the formula; the function
-- now reads the column back instead of recomputing it.

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

  -- Written by refresh_issue_support_count on the insert or delete above.
  select issues.support_count into next_support_count
  from app_private.issues where issues.id = backend_toggle_support.issue_id;

  if not remove_support and issue_record.support_goal is not null and next_support_count >= issue_record.support_goal and issue_record.support_met_at is null then
    became_goal_met := true;
    update app_private.issues
    set support_met_at = now(),
        status = case when status = 'pending' then 'processing' else status end,
        response_deadline_at = case
          when response_deadline_days is not null then now() + make_interval(days => response_deadline_days)
          else response_deadline_at
        end
    where id = issue_id;
  end if;

  return query select not remove_support, next_support_count, became_goal_met;
end;
$$;

-- Repair the proposals the overwriting function drifted.
update app_private.issues
set support_count = case when support_enabled then 1 else 0 end
  + (select count(*)::integer from app_private.supports where supports.issue_id = issues.id)
where support_count <> case when support_enabled then 1 else 0 end
  + (select count(*)::integer from app_private.supports where supports.issue_id = issues.id);

-- A deleted proposal has to reach the same audience the live one did.
--
-- The realtime fan-out decides a proposal's audience from its read access and
-- status, and the row is gone by the time the delivery is built, so deletion
-- has to carry both out of the transaction. Without them every deletion was
-- treated as owner-only and the proposal stayed on every other reader's feed
-- until they reloaded.
create or replace function app_api.backend_delete_issue_with_upload_targets(
  issue_id uuid,
  actor_uid text,
  actor_is_admin boolean
) returns jsonb
language plpgsql
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  issue_record app_private.issues%rowtype;
  upload_targets jsonb;
  supporter_uids jsonb;
begin
  select * into issue_record
  from app_private.issues
  where id = backend_delete_issue_with_upload_targets.issue_id
  for update;

  if not found then
    return jsonb_build_object(
      'success', true,
      'issueId', backend_delete_issue_with_upload_targets.issue_id,
      'uploadTargets', '[]'::jsonb,
      'supporterUids', '[]'::jsonb
    );
  end if;

  if issue_record.author_uid <> backend_delete_issue_with_upload_targets.actor_uid
    and not backend_delete_issue_with_upload_targets.actor_is_admin
  then
    raise exception 'permission-denied';
  end if;

  select jsonb_build_array(jsonb_build_object('id', issue_record.id, 'type', 'issue'))
    || coalesce(jsonb_agg(jsonb_build_object('id', comment.id, 'type', 'comment')), '[]'::jsonb)
  into upload_targets
  from app_private.comments comment
  where comment.issue_id = issue_record.id;

  select coalesce(jsonb_agg(supporter.uid order by supporter.created_at), '[]'::jsonb)
  into supporter_uids
  from app_private.supports supporter
  where supporter.issue_id = issue_record.id;

  delete from app_private.issues where id = issue_record.id;

  return jsonb_build_object(
    'success', true,
    'issueId', issue_record.id,
    'authorUid', issue_record.author_uid,
    'issueCategory', issue_record.category,
    'readAccess', issue_record.read_access,
    'status', issue_record.status,
    'supporterUids', supporter_uids,
    'title', issue_record.title,
    'uploadTargets', upload_targets
  );
end;
$$;
