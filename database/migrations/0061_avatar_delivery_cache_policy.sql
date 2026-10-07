-- Add delivery cache lifetimes without resetting any existing runtime policy.
update app_private.runtime_settings
set value = jsonb_set(
  value::jsonb,
  '{values}',
  '{"avatarBrowserSeconds":31536000,"avatarEdgeSeconds":86400}'::jsonb || (value::jsonb->'values')
)::text,
    updated_at = now()
where key = 'operations_settings';
