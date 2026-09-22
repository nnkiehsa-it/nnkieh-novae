-- Preserve explicit nulls when returning a proposal to review.
create or replace function app_api.backend_moderate_issue_status(
  issue_id uuid, actor_uid text, actor_is_admin boolean, next_status text,
  review_rejection_reason text, support_deadline_at timestamptz, review_approved_at timestamptz,
  private_to_owner_categories text[], review_required_categories text[], author_private_categories text[]
) returns jsonb
language plpgsql security definer set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  issue_record app_private.issues%rowtype;
begin
  if not actor_is_admin then raise exception 'permission-denied'; end if;
  select * into issue_record from app_private.issues where id = issue_id for update;
  if not found then raise exception 'not-found'; end if;
  update app_private.issues
  set status = next_status,
      review_rejection_reason = case when next_status = 'review-rejected' then backend_moderate_issue_status.review_rejection_reason else null end,
      support_deadline_at = backend_moderate_issue_status.support_deadline_at,
      review_approved_at = backend_moderate_issue_status.review_approved_at,
      closed_at = case when next_status in ('auto-rejected', 'review-rejected', 'infeasible', 'completed') then now() else null end
  where id = issue_id returning * into issue_record;
  return app_api.backend_issue_to_json(issue_record, actor_uid, actor_is_admin,
    private_to_owner_categories, review_required_categories, author_private_categories);
end;
$$;
