-- Add the client heartbeat interval to every stored operations-policy snapshot.

update app_private.runtime_settings
set value = jsonb_set(
  value::jsonb,
  '{values}',
  value::jsonb->'values' || '{"realtimeHeartbeatSeconds":30}'::jsonb
)::text,
    updated_at = now()
where key = 'operations_settings';
