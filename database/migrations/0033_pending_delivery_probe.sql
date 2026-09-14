-- A sweep asks once what there is to carry, instead of five times.

-- Every write sends the consumer a drain message, and a drain claimed a batch
-- for each destination in turn: five round trips to the database before it
-- could know that four of them had nothing waiting. The claim predicate now
-- lives in one view, so the sweep can ask for the destinations that actually
-- have work and skip the rest, and the predicate cannot drift away from the
-- claim it describes.

create view app_private.claimable_event_deliveries as
  select d.*
  from app_private.event_deliveries d
  where d.attempt_count < 8
    and ((d.status in ('pending', 'failed') and d.next_attempt_at <= now())
      or (d.status = 'processing' and d.locked_at < now() - interval '10 minutes'));

create or replace function app_api.claim_event_deliveries(target_destination text, batch_size integer default 25)
returns table(delivery_id uuid, event_id uuid, operation_id uuid, destination text, attempt_count integer,
  event_type text, aggregate_type text, aggregate_id text, actor_uid text, occurred_at timestamptz,
  payload jsonb, aggregate_version integer, last_attempt_id uuid)
language plpgsql security definer set search_path to 'app_private', 'app_api', 'public'
as $$
begin
  return query
  with candidates as (
    select d.id from app_private.claimable_event_deliveries d
    where d.destination = target_destination
    order by d.next_attempt_at, d.created_at limit least(greatest(batch_size, 1), 100)
    for update skip locked
  ), claimed as (
    update app_private.event_deliveries d set status = 'processing', attempt_count = d.attempt_count + 1,
      last_attempt_id = gen_random_uuid(), locked_at = now(), updated_at = now()
    from candidates c where d.id = c.id returning d.*
  ) select d.id, e.event_id, e.operation_id, d.destination, d.attempt_count, e.event_type,
    e.aggregate_type, e.aggregate_id, e.actor_uid, e.occurred_at, e.payload, e.aggregate_version, d.last_attempt_id
    from claimed d join app_private.domain_events e on e.event_id = d.event_id;
end;
$$;

create function app_api.pending_delivery_destinations()
returns text[]
language sql
stable
security definer
set search_path to 'app_private', 'app_api', 'public'
as $$
  select coalesce(array_agg(distinct d.destination), array[]::text[])
  from app_private.claimable_event_deliveries d;
$$;

revoke all on function app_api.pending_delivery_destinations() from public;
grant execute on function app_api.pending_delivery_destinations() to novae_runtime;
