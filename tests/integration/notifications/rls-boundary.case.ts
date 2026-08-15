import { Client } from "pg";
import { assert, integrationTest, requiredEnv } from "./support.ts";

integrationTest("Worker database role can use app data but cannot mutate the schema", async () => {
  const client = new Client({ connectionString: requiredEnv("DATABASE_URL") });
  await client.connect();
  try {
    const role = await client.query(`
      select r.rolsuper, r.rolcreatedb, r.rolcreaterole,
             has_schema_privilege(current_user, 'app_private', 'create') as schema_create
      from pg_roles r where r.rolname = current_user
    `);
    assert.deepEqual(role.rows[0], {
      rolcreatedb: false,
      rolcreaterole: false,
      rolsuper: false,
      schema_create: false,
    });
    assert.ok(Number((await client.query("select count(*) from app_private.roles")).rows[0].count) > 0);
    await assert.rejects(
      () => client.query("create table app_private.integration_forbidden_ddl(id integer)"),
      (error: unknown) => typeof error === "object" && error !== null && "code" in error && error.code === "42501",
    );
  } finally {
    await client.end();
  }
});
