insert into app_private.runtime_settings(key, value, updated_at)
values
  (
    'data_retention_settings',
    '{"closedIssuesEnabled":true,"closedIssuesDays":180,"closedFacilitiesEnabled":true,"closedFacilitiesDays":180}',
    now()
  ),
  (
    'image_upload_settings',
    '{"issueMaxImages":2,"facilityMaxImages":2,"announcementMaxImages":10,"commentMaxImages":1,"maxUploadKilobytes":800,"maxSourceMegabytes":20,"maxDimension":2000,"webpQuality":0.82}',
    now()
  )
on conflict (key) do nothing;

do $$
declare
  definition text;
begin
  select pg_get_functiondef('app_private.run_maintenance_cleanup(text[], jsonb)'::regprocedure)
  into definition;

  definition := replace(
    definition,
    '  run_status text := ''success'';',
    '  run_status text := ''success'';' || E'\n'
      || '  closed_issue_cleanup_enabled boolean := coalesce((retention_config->>''closedIssuesEnabled'')::boolean, true);' || E'\n'
      || '  closed_facility_cleanup_enabled boolean := coalesce((retention_config->>''closedFacilitiesEnabled'')::boolean, true);'
  );
  definition := replace(
    definition,
    '    where status in (''auto-rejected'', ''review-rejected'', ''infeasible'', ''completed'')' || E'\n'
      || '      and closed_at < now() - make_interval(days => closed_issue_days)',
    '    where closed_issue_cleanup_enabled' || E'\n'
      || '      and status in (''auto-rejected'', ''review-rejected'', ''infeasible'', ''completed'')' || E'\n'
      || '      and closed_at < now() - make_interval(days => closed_issue_days)'
  );
  definition := replace(
    definition,
    '    where status in (''completed'', ''unable-to-handle'')' || E'\n'
      || '      and closed_at < now() - make_interval(days => closed_facility_days)',
    '    where closed_facility_cleanup_enabled' || E'\n'
      || '      and status in (''completed'', ''unable-to-handle'')' || E'\n'
      || '      and closed_at < now() - make_interval(days => closed_facility_days)'
  );

  if position('closed_issue_cleanup_enabled boolean' in definition) = 0
    or position('where closed_issue_cleanup_enabled' in definition) = 0
    or position('where closed_facility_cleanup_enabled' in definition) = 0 then
    raise exception 'could not apply configurable closed-content retention';
  end if;
  execute definition;
end;
$$;
