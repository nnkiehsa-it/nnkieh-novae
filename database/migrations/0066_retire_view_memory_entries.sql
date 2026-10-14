-- Screens keep what they read in one query cache that collects what nothing
-- shows; there is no entry limit left for an administrator to tune.
update app_private.runtime_settings
set value = jsonb_set(value::jsonb, '{values}', (value::jsonb->'values') - 'viewMemoryEntries')::text
where key = 'operations_settings' and value::jsonb->'values' ? 'viewMemoryEntries';
