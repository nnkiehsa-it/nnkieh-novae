-- Skip rules held by an administrator's transaction instead of deleting a renewed rule.
do $$
declare definition text; updated text;
begin
  definition := pg_get_functiondef('app_private.run_retention_cleanup_core_batch(jsonb,integer)'::regprocedure);
  updated := replace(definition,
    'order by target_type, uid limit limited',
    'order by target_type, uid limit limited for update skip locked');
  if updated = definition then raise exception 'account-rule-cleanup-lock-definition-mismatch'; end if;
  execute updated;
end;
$$;
