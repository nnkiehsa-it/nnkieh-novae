update app_private.runtime_settings set value=jsonb_set(value::jsonb,'{values}',
  value::jsonb->'values' || '{"readBurst":60,"writeBurst":20,"sensitiveBurst":10,"adminBurst":10,"uploadBurst":6,"resolveBurst":30,"viewMemoryMinutes":30,"viewMemoryEntries":100,"feedPages":5,"mediaBrowserSeconds":60,"mediaEdgeSeconds":60,"notionBatchSize":10,"notificationBatchSize":20,"realtimeBatchSize":50}'::jsonb)::text
where key='operations_settings';
grant delete on app_private.operation_policy_history to novae_runtime;
