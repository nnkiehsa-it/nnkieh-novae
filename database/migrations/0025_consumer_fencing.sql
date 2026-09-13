-- The database assigns each claim a fresh token, including manual retries.
drop function app_api.claim_event_deliveries(text,integer);
create function app_api.claim_event_deliveries(target_destination text,batch_size integer default 25)
returns table(delivery_id uuid,event_id uuid,operation_id uuid,destination text,attempt_count integer,
  event_type text,aggregate_type text,aggregate_id text,actor_uid text,occurred_at timestamptz,
  payload jsonb,aggregate_version integer,last_attempt_id uuid)
language plpgsql security definer set search_path to 'app_private','app_api','public'
as $$
begin
  return query
  with candidates as (
    select d.id from app_private.event_deliveries d
    where d.destination=target_destination and d.attempt_count<8
      and ((d.status in ('pending','failed') and d.next_attempt_at<=now())
        or (d.status='processing' and d.locked_at<now()-interval '10 minutes'))
    order by d.next_attempt_at,d.created_at limit least(greatest(batch_size,1),100)
    for update skip locked
  ), claimed as (
    update app_private.event_deliveries d set status='processing',attempt_count=d.attempt_count+1,
      last_attempt_id=gen_random_uuid(),locked_at=now(),updated_at=now()
    from candidates c where d.id=c.id returning d.*
  ) select d.id,e.event_id,e.operation_id,d.destination,d.attempt_count,e.event_type,
    e.aggregate_type,e.aggregate_id,e.actor_uid,e.occurred_at,e.payload,e.aggregate_version,d.last_attempt_id
    from claimed d join app_private.domain_events e on e.event_id=d.event_id;
end;
$$;
revoke all on function app_api.claim_event_deliveries(text,integer) from public;
grant execute on function app_api.claim_event_deliveries(text,integer) to novae_runtime;

create or replace function app_api.complete_event_delivery(delivery_id uuid, attempt_id uuid)
returns void language plpgsql security definer
set search_path to 'app_private','app_api','public'
as $$
begin
  update app_private.event_deliveries
  set status='completed',completed_at=now(),error_detail=null,expires_at=app_private.runtime_retention_deadline('deliveryCompletedDays'),last_attempt_id=attempt_id,locked_at=null,updated_at=now()
  where id=complete_event_delivery.delivery_id and status='processing'
    and last_attempt_id=attempt_id;
  if not found then raise exception 'stale-work-claim'; end if;
end;
$$;

create or replace function app_api.fail_event_delivery(delivery_id uuid, attempt_id uuid, error_info jsonb)
returns void language plpgsql security definer
set search_path to 'app_private','app_api','public'
as $$
begin
  update app_private.event_deliveries
  set status='failed',error_detail=error_info,next_attempt_at=now()+make_interval(mins=>least(60,greatest(1,attempt_count*2))),expires_at=app_private.runtime_retention_deadline('deliveryFailedDays'),last_attempt_id=attempt_id,locked_at=null,updated_at=now()
  where id=fail_event_delivery.delivery_id and status='processing'
    and last_attempt_id=attempt_id;
  if not found then raise exception 'stale-work-claim'; end if;
end;
$$;

create or replace function app_api.complete_background_job(job_id uuid, attempt_id uuid, job_result jsonb default '{}'::jsonb)
returns void language plpgsql security definer
set search_path to 'app_private','app_api','public'
as $$
begin
  update app_private.background_jobs
  set status='completed',completed_at=now(),result=job_result,error_detail=null,expires_at=app_private.runtime_retention_deadline('backgroundJobCompletedDays'),last_attempt_id=attempt_id,locked_at=null,updated_at=now()
  where id=complete_background_job.job_id and status='processing'
    and last_attempt_id=attempt_id;
  if not found then raise exception 'stale-work-claim'; end if;
end;
$$;

create or replace function app_api.fail_background_job(job_id uuid, attempt_id uuid, error_info jsonb)
returns void language plpgsql security definer
set search_path to 'app_private','app_api','public'
as $$
begin
  update app_private.background_jobs
  set status='failed',error_detail=error_info,next_attempt_at=now()+make_interval(mins=>least(60,greatest(1,attempt_count*2))),expires_at=app_private.runtime_retention_deadline('backgroundJobFailedDays'),last_attempt_id=attempt_id,locked_at=null,updated_at=now()
  where id=fail_background_job.job_id and status='processing'
    and last_attempt_id=attempt_id;
  if not found then raise exception 'stale-work-claim'; end if;
end;
$$;
