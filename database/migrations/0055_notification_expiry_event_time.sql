-- Align existing notifications with the event-time expiry used by new deliveries.
-- The repair scope updates retention metadata without deleting notifications.
alter function app_private.retention_change_scopes(jsonb, jsonb) rename to retention_rule_change_scopes;

create function app_private.retention_change_scopes(before_config jsonb, after_config jsonb)
returns jsonb language plpgsql stable
set search_path to 'app_private', 'public'
as $$
declare scopes jsonb := app_private.retention_rule_change_scopes(before_config, after_config);
begin
  -- A second settings save must carry any unfinished expiry repair into its replacement job.
  if before_config is distinct from after_config and not (scopes ? 'notificationExpiry')
    and exists(select 1 from app_private.notifications
      where expires_at is distinct from case when (after_config->>'notificationsEnabled')::boolean
        then created_at + make_interval(days => (after_config->>'notificationsDays')::integer)
        else 'infinity'::timestamptz end)
  then scopes := scopes || '["notificationExpiry"]'::jsonb; end if;
  return scopes;
end;
$$;
revoke all on function app_private.retention_change_scopes(jsonb, jsonb) from public;
grant execute on function app_private.retention_change_scopes(jsonb, jsonb) to novae_runtime;

do $$
declare
  config jsonb := app_private.runtime_retention_config()
    || jsonb_build_object('cleanupScopes', '["notificationExpiry"]'::jsonb);
begin
  if (app_private.retention_cleanup_estimate(config)->>'totalUpdatedRows')::bigint > 0 then
    perform app_private.enqueue_policy_job('retention-cleanup', 'notification-expiry-repair', config, 'migration:0055');
  end if;
end;
$$;
