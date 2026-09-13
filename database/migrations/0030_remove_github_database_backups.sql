do $$
declare
  retired_keys text[] := array['backupIntervalHours', 'backupCopies', 'backupRetentionDays'];
begin
  update app_private.runtime_settings
  set value = jsonb_set(
    value::jsonb,
    '{values}',
    (value::jsonb->'values') - retired_keys
  )::text,
      updated_at = now()
  where key = 'operations_settings';

  update app_private.operation_policy_history
  set before_value = before_value - retired_keys,
      after_value = after_value - retired_keys
  where before_value ?| retired_keys or after_value ?| retired_keys;
end;
$$;
