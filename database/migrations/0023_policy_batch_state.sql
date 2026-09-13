create or replace function app_api.backend_process_platform_job_batch(batch_size integer default 100)
returns jsonb language plpgsql security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  limited integer := least(greatest(batch_size,1),500);
  job app_private.background_jobs%rowtype;
  batch_result jsonb;
  changed integer := 0;
  has_more boolean := false;
  desired boolean;
  attempt uuid := gen_random_uuid();
begin
  select * into job from app_private.background_jobs
  where job_type in ('retention_cleanup','category_policy')
    and (status in ('pending','processing') or (status='failed' and attempt_count<8 and next_attempt_at<=now()))
  order by created_at,id limit 1 for update skip locked;
  if job.id is null then return jsonb_build_object('hasMore',false,'processed',0); end if;

  begin
    update app_private.background_jobs set status='processing',locked_at=now(),
      started_at=coalesce(started_at,now()),last_attempt_id=attempt,updated_at=now()
    where id=job.id;

    if job.job_type='retention_cleanup' then
      batch_result := app_private.run_retention_cleanup_batch(job.payload,limited);
      changed := (batch_result->>'affectedRows')::integer;
      has_more := (batch_result->>'hasMore')::boolean;
    elsif job.payload->>'policyType'='announcement-comments' then
      desired := (job.payload->>'enabled')::boolean;
      with targets as (
        select id from app_private.announcements where comments_enabled is distinct from desired
        order by id limit limited
      ), changed_rows as (
        update app_private.announcements set comments_enabled=desired
        where id in(select id from targets) returning 1
      ) select count(*) into changed from changed_rows;
      has_more := changed=limited;
      batch_result := jsonb_build_object('affectedRows',changed,'hasMore',has_more);
    elsif job.payload->>'policyType'='issue-category-comments' then
      desired := (job.payload->>'enabled')::boolean;
      with targets as (
        select id from app_private.issues where category=job.scope_id
          and comments_enabled is distinct from (desired and status not in ('completed','infeasible','review-rejected','auto-rejected'))
        order by id limit limited
      ), changed_rows as (
        update app_private.issues set comments_enabled=(desired and status not in ('completed','infeasible','review-rejected','auto-rejected'))
        where id in(select id from targets) returning 1
      ) select count(*) into changed from changed_rows;
      has_more := changed=limited;
      batch_result := jsonb_build_object('affectedRows',changed,'hasMore',has_more);
    else raise exception 'unsupported-policy-job';
    end if;

    update app_private.background_jobs set affected_rows=affected_rows+changed,
      processed_rows=processed_rows+changed,status=case when has_more then 'pending' else 'completed' end,
      completed_at=case when has_more then null else now() end,locked_at=null,error_detail=null,
      result=batch_result,updated_at=now(),expires_at=app_private.runtime_retention_deadline('backgroundJobCompletedDays')
    where id=job.id;
  exception when others then
    update app_private.background_jobs set status='failed',attempt_count=attempt_count+1,
      last_attempt_id=attempt,locked_at=null,updated_at=now(),
      error_detail=jsonb_build_object('code',sqlstate,'message',left(sqlerrm,500)),
      next_attempt_at=now()+interval '2 minutes',expires_at=app_private.runtime_retention_deadline('backgroundJobFailedDays')
    where id=job.id;
    return jsonb_build_object('jobId',job.id,'failed',true,'hasMore',false,'affectedRows',0);
  end;
  return jsonb_build_object('jobId',job.id,'hasMore',has_more,'affectedRows',changed,'details',batch_result->'details');
end;
$$;

select app_private.enqueue_policy_job('announcement-comments','global',
  jsonb_build_object('enabled',announcement_comments_enabled),'migration:0023')
from app_private.system_setup where singleton;
select app_private.enqueue_policy_job('issue-category-comments',id,
  jsonb_build_object('enabled',comments_enabled),'migration:0023')
from app_private.issue_categories;
