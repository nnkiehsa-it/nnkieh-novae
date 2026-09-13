update app_private.runtime_settings
set value = (value::jsonb || jsonb_build_object('domainEventDays', 30))::text
where key = 'data_retention_settings';

alter table app_private.operations add column response_expired boolean not null default false;
alter table app_private.operations drop constraint operations_lifecycle_check;
alter table app_private.operations add constraint operations_lifecycle_check check(
  updated_at>=created_at and expires_at>=created_at
  and (status<>'completed' or response is not null or response_expired)
  and (not response_expired or (status='completed' and response is null))
  and (status<>'failed' or error_detail is not null));
create index operations_response_expiry_idx on app_private.operations(expires_at)
  where status='completed' and not response_expired;

alter function app_private.retention_cleanup_estimate(jsonb) rename to content_retention_estimate;
create function app_private.retention_cleanup_estimate(retention_config jsonb)
returns jsonb language plpgsql stable security definer
set search_path to 'app_private', 'public'
as $$
declare result jsonb; events bigint; responses bigint;
begin
  result := app_private.content_retention_estimate(retention_config);
  select count(*) into events from app_private.domain_events event
  where occurred_at < now() - make_interval(days => app_private.retention_integer(retention_config,'domainEventDays'))
    and not exists(select 1 from app_private.event_deliveries where event_id=event.event_id);
  select count(*) into responses from app_private.operations operation
    where status='completed' and not response_expired
      and expires_at < now()
      and (exists(select 1 from app_private.domain_events where operation_id=operation.operation_id)
        or exists(select 1 from app_private.admin_audit_log where operation_id=operation.operation_id));
  return result || jsonb_build_object('totalEstimatedRows', (result->>'totalEstimatedRows')::bigint + events + responses,
    'details', (result->'details') || jsonb_build_object('domainEvents',events,'operationResponses',responses));
end;
$$;
revoke all on function app_private.retention_cleanup_estimate(jsonb) from public;
grant execute on function app_private.retention_cleanup_estimate(jsonb) to novae_runtime;

-- Keep content/privacy cleanup separate from the event/operation lifecycle.
alter function app_private.run_retention_cleanup_batch(jsonb, integer)
  rename to run_content_retention_batch;

create function app_private.run_retention_cleanup_batch(retention_config jsonb, batch_size integer default 100)
returns jsonb language plpgsql security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
declare
  limited integer := least(greatest(batch_size, 1), 500);
  event_days integer := app_private.retention_integer(retention_config, 'domainEventDays');
  event_count integer;
  response_count integer;
  result jsonb;
begin
  with targets as (
    select operation.operation_id from app_private.operations operation
    where status='completed' and not response_expired
      and expires_at < now()
      and (exists(select 1 from app_private.domain_events where operation_id=operation.operation_id)
        or exists(select 1 from app_private.admin_audit_log where operation_id=operation.operation_id))
    order by created_at limit limited for update skip locked
  ), compacted as (
    update app_private.operations set response=null,response_expired=true,updated_at=now()
    where operation_id in(select operation_id from targets) returning 1
  ) select count(*) into response_count from compacted;
  with targets as (
    select event.event_id from app_private.domain_events event
    where event.occurred_at < now() - make_interval(days => event_days)
      and not exists(select 1 from app_private.event_deliveries delivery where delivery.event_id = event.event_id)
    order by event.occurred_at limit limited
  ), removed as (
    delete from app_private.domain_events where event_id in (select event_id from targets) returning 1
  ) select count(*) into event_count from removed;

  result := app_private.run_content_retention_batch(retention_config, limited);
  return result || jsonb_build_object(
    'affectedRows', (result->>'affectedRows')::integer + event_count + response_count,
    'hasMore', (result->>'hasMore')::boolean or event_count = limited or response_count = limited,
    'details', (result->'details') || jsonb_build_object('domainEvents', event_count,'operationResponses',response_count)
  );
end;
$$;

revoke all on function app_private.run_retention_cleanup_batch(jsonb,integer) from public;
grant execute on function app_private.run_retention_cleanup_batch(jsonb,integer) to novae_runtime;

select app_private.enqueue_policy_job('retention-cleanup','global',app_private.runtime_retention_config(),'migration:0021');
