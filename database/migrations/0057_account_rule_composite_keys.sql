-- Account rules use (target_type, uid); cleanup must keep both parts of that key.
do $$
declare definition text; updated text;
begin
  definition := pg_get_functiondef('app_private.run_retention_cleanup_core_batch(jsonb,integer)'::regprocedure);
  updated := replace(definition, 'select uid from app_private.user_restrictions', 'select target_type, uid from app_private.user_restrictions');
  updated := replace(updated,
    'where not restricted_permanently and restricted_until < now() - make_interval(days => restriction_days)
      order by uid limit limited',
    'where not restricted_permanently and restricted_until < now() - make_interval(days => restriction_days)
      order by target_type, uid limit limited');
  updated := replace(updated,
    'delete from app_private.user_restrictions where uid in (select uid from targets) returning 1',
    'delete from app_private.user_restrictions r using targets t where r.target_type = t.target_type and r.uid = t.uid returning 1');
  if updated = definition then raise exception 'account-rule-cleanup-definition-mismatch'; end if;
  execute updated;

  definition := pg_get_functiondef('app_api.backend_list_admin_users(text,integer,integer)'::regprocedure);
  updated := replace(definition, 'r.uid=p.uid', 'r.uid=p.uid and r.target_type=''uid''');
  if updated = definition then raise exception 'account-rule-list-definition-mismatch'; end if;
  execute updated;
end;
$$;
