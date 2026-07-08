create or replace function app_api.backend_issue_to_json(
  issue_record app_private.issues,
  actor_uid text,
  actor_is_admin boolean,
  private_to_owner_categories text[],
  review_required_categories text[],
  author_private_categories text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = app_private, app_api, public
as $$
declare
  is_own_issue boolean := issue_record.author_uid = actor_uid;
  can_manage_issue boolean := actor_is_admin or issue_record.author_uid = actor_uid;
  can_view_author boolean := actor_is_admin
    or issue_record.author_uid = actor_uid
    or issue_record.category <> all(author_private_categories);
  current_user_supported boolean;
begin
  if not actor_is_admin
    and not is_own_issue
    and issue_record.category = any(private_to_owner_categories)
  then
    raise exception 'not-found';
  end if;

  if not actor_is_admin
    and not is_own_issue
    and issue_record.category = any(review_required_categories)
    and issue_record.status in ('under-review', 'review-rejected')
  then
    raise exception 'not-found';
  end if;

  select exists (
    select 1
    from app_private.supports
    where supports.issue_id = issue_record.id
      and supports.uid = actor_uid
  ) into current_user_supported;

  return jsonb_build_object(
    'id', issue_record.id,
    'title', issue_record.title,
    'content', issue_record.content,
    'created_at', issue_record.created_at,
    'updated_at', issue_record.updated_at,
    'created_at_ms', floor(extract(epoch from issue_record.created_at) * 1000),
    'updated_at_ms', floor(extract(epoch from issue_record.updated_at) * 1000),
    'support_count', issue_record.support_count,
    'status', issue_record.status,
    'category', issue_record.category,
    'support_enabled', issue_record.support_enabled,
    'support_goal', issue_record.support_goal,
    'support_deadline_at', issue_record.support_deadline_at,
    'support_deadline_at_ms', case when issue_record.support_deadline_at is null then null else floor(extract(epoch from issue_record.support_deadline_at) * 1000) end,
    'response_deadline_at', issue_record.response_deadline_at,
    'response_deadline_at_ms', case when issue_record.response_deadline_at is null then null else floor(extract(epoch from issue_record.response_deadline_at) * 1000) end,
    'review_approved_at', issue_record.review_approved_at,
    'review_approved_at_ms', case when issue_record.review_approved_at is null then null else floor(extract(epoch from issue_record.review_approved_at) * 1000) end,
    'result_content', issue_record.result_content,
    'result_updated_at', issue_record.result_updated_at,
    'result_updated_at_ms', case when issue_record.result_updated_at is null then null else floor(extract(epoch from issue_record.result_updated_at) * 1000) end,
    'support_met_at', issue_record.support_met_at,
    'support_met_at_ms', case when issue_record.support_met_at is null then null else floor(extract(epoch from issue_record.support_met_at) * 1000) end,
    'review_rejection_reason', issue_record.review_rejection_reason,
    'deleting', false,
    'currentUserSupported', current_user_supported,
    'isOwnIssue', is_own_issue,
    'canManageIssue', can_manage_issue,
    'canViewAuthor', can_view_author,
    'author_uid', case when can_view_author then issue_record.author_uid else null end,
    'author_name', case when can_view_author then issue_record.author_name else null end,
    'author_photo_url', case when can_view_author then issue_record.author_photo_url else null end
  );
end;
$$;

grant execute on function app_api.backend_issue_to_json(app_private.issues,text,boolean,text[],text[],text[]) to service_role;
