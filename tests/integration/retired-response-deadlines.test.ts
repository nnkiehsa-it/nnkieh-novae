import assert from "node:assert/strict";
import { database, integrationTest } from "./helpers.ts";

integrationTest("response deadlines are removed from the live schema and RPC contracts", async () => {
  const columns = await database.sql<{ column_name: string }>`
    select column_name from information_schema.columns
    where table_schema = 'app_private'
      and table_name in ('issues', 'issue_categories')
      and column_name in ('response_deadline_at', 'response_deadline_days')`;
  assert.deepEqual(columns.rows, []);

  const functions = await database.sql<{
    name: string;
    args: string[];
    public_execute: boolean;
    runtime_execute: boolean;
  }>`
    select p.proname as name, p.proargnames as args,
      exists(select 1 from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) acl
        where acl.grantee = 0 and acl.privilege_type = 'EXECUTE') as public_execute,
      has_function_privilege('novae_runtime', p.oid, 'EXECUTE') as runtime_execute
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_api' and p.proname in
      ('backend_create_issue', 'backend_moderate_issue_status', 'backend_toggle_support')
    order by p.proname`;
  assert.equal(functions.rows.length, 3, "old function overloads must not survive");
  for (const fn of functions.rows) {
    assert.equal(fn.args.some((arg) => arg.startsWith("response_deadline")), false, fn.name);
    assert.equal(fn.public_execute, false, fn.name);
    assert.equal(fn.runtime_execute, true, fn.name);
  }
});
