import process from "node:process";
import { writeFile } from "node:fs/promises";
import pg from "pg";

const { Client } = pg;
const connectionOutputIndex = process.argv.indexOf("--connection-output");
const connectionOutput = connectionOutputIndex === -1 ? undefined : process.argv[connectionOutputIndex + 1];
const roleName = (process.env.DATABASE_RUNTIME_ROLE || "novae_runtime").trim();
const password = process.env.DATABASE_RUNTIME_PASSWORD?.trim();
const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) throw new Error("DATABASE_URL is required.");
if (!password) throw new Error("DATABASE_RUNTIME_PASSWORD is required.");
if (connectionOutputIndex !== -1 && !connectionOutput) {
  throw new Error("--connection-output requires a file path.");
}
if (!/^[a-z_][a-z0-9_]{0,62}$/u.test(roleName)) {
  throw new Error("DATABASE_RUNTIME_ROLE must be a safe PostgreSQL role name.");
}

const client = new Client({ connectionString });
await client.connect();
try {
  const role = await client.query("select 1 from pg_roles where rolname = $1", [roleName]);
  const quotedRole = `"${roleName}"`;
  if (role.rowCount === 0) await client.query(`create role ${quotedRole} login`);
  const passwordStatement = await client.query(
    "select format('alter role %I with login nocreatedb nocreaterole noinherit password %L', $1::text, $2::text) as sql",
    [roleName, password],
  );
  await client.query(passwordStatement.rows[0].sql);
  const databaseGrant = await client.query(
    "select format('grant connect on database %I to %I', current_database(), $1::text) as sql",
    [roleName],
  );
  await client.query(databaseGrant.rows[0].sql);
  await client.query(`grant usage on schema app_private, app_api to ${quotedRole}`);
  await client.query(`grant select, insert, update, delete on all tables in schema app_private to ${quotedRole}`);
  await client.query(`grant usage, select on all sequences in schema app_private to ${quotedRole}`);
  await client.query(`grant execute on all functions in schema app_private, app_api to ${quotedRole}`);
  await client.query(`alter default privileges in schema app_private grant select, insert, update, delete on tables to ${quotedRole}`);
  await client.query(`alter default privileges in schema app_private grant usage, select on sequences to ${quotedRole}`);
  await client.query(`alter default privileges in schema app_private grant execute on functions to ${quotedRole}`);
  await client.query(`alter default privileges in schema app_api grant execute on functions to ${quotedRole}`);
  await client.query(`revoke create on schema public from ${quotedRole}`);
  console.log(`Configured least-privilege PostgreSQL role ${roleName}.`);
} finally {
  await client.end();
}

const runtimeUrl = new URL(connectionString);
runtimeUrl.username = roleName;
runtimeUrl.password = password;
const runtimeConnectionString = runtimeUrl.toString();
const runtimeClient = new Client({ connectionString: runtimeConnectionString });
await runtimeClient.connect();
try {
  await runtimeClient.query("select code from app_private.roles limit 1");
} finally {
  await runtimeClient.end();
}

if (connectionOutput) {
  await writeFile(connectionOutput, runtimeConnectionString, { encoding: "utf8", mode: 0o600 });
}
console.log(`Verified least-privilege PostgreSQL role ${roleName}.`);
