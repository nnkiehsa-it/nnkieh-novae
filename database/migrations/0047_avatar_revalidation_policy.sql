-- Keep the avatar refresh interval with the other runtime policies.
update app_private.runtime_settings
set value = jsonb_set(
  value::jsonb,
  '{values}',
  value::jsonb->'values' || '{"avatarRevalidateHours":24}'::jsonb
)::text,
    updated_at = now()
where key = 'operations_settings';
