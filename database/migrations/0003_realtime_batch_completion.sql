create or replace function app_api.complete_realtime_events(event_ids uuid[])
returns void
language sql
security definer
set search_path = app_private, app_api, pg_catalog
as $$
  update app_private.realtime_events
  set status = 'completed',
      completed_at = now(),
      locked_at = null,
      error_trace_id = null,
      payload = '{}'::jsonb
  where id = any(event_ids);
$$;

create or replace function app_api.fail_realtime_events(event_ids uuid[], trace_id text)
returns void
language sql
security definer
set search_path = app_private, app_api, pg_catalog
as $$
  update app_private.realtime_events
  set status = case when attempt_count >= 10 then 'failed' else 'pending' end,
      next_attempt_at = case
        when attempt_count >= 10 then next_attempt_at
        else now() + least(interval '15 minutes', interval '5 seconds' * power(2, greatest(attempt_count - 1, 0)))
      end,
      locked_at = null,
      error_trace_id = left(trace_id, 120)
  where id = any(event_ids);
$$;

revoke all on function app_api.complete_realtime_events(uuid[]) from public;
revoke all on function app_api.fail_realtime_events(uuid[], text) from public;
