import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import pg from "pg";

const connectionString = process.env.DATABASE_OWNER_URL
  || process.env.DATABASE_URL
  || "postgresql://novae:novae-local@127.0.0.1:55432/novae";

const outputUrl = new URL("../cloudflare/src/backend/database/schema.generated.ts", import.meta.url);
const checkOnly = process.argv.includes("--check");
const client = new pg.Client({ connectionString });
await client.connect();

function tsType(column) {
  if (column.data_type === "ARRAY") return "unknown[]";
  if (column.data_type === "boolean") return "boolean";
  if (["bigint", "double precision", "integer", "numeric", "real", "smallint"].includes(column.data_type)) return "number";
  if (["json", "jsonb"].includes(column.data_type)) return "GeneratedJson";
  return "string";
}

try {
  const { rows: columns } = await client.query(`
    select table_name, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema='app_private'
    order by table_name, ordinal_position
  `);
  const { rows: functions } = await client.query(`
    select p.proname as name, pg_get_function_identity_arguments(p.oid) as arguments,
      pg_get_function_result(p.oid) as result
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='app_api'
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  `);
  const tables = new Map();
  for (const column of columns) {
    const entries = tables.get(column.table_name) ?? [];
    entries.push(column);
    tables.set(column.table_name, entries);
  }

  const lines = [
    "// Generated from the fully migrated PostgreSQL schema. Do not edit by hand.",
    "export type GeneratedJson = null | boolean | number | string | GeneratedJson[] | { [key: string]: GeneratedJson };",
    "",
    "export interface GeneratedDatabaseTables {",
  ];
  for (const [tableName, entries] of tables) {
    lines.push(`  ${JSON.stringify(tableName)}: {`);
    for (const column of entries) {
      const nullable = column.is_nullable === "YES" ? " | null" : "";
      lines.push(`    ${JSON.stringify(column.column_name)}: ${tsType(column)}${nullable};`);
    }
    lines.push("  };");
  }
  lines.push("}", "", "export const GENERATED_DATABASE_FUNCTION_SIGNATURES = [");
  for (const fn of functions) {
    lines.push(`  ${JSON.stringify(`${fn.name}(${fn.arguments}) -> ${fn.result}`)},`);
  }
  lines.push("] as const;", "");
  const generated = `${lines.join("\n")}\n`;

  if (checkOnly) {
    const current = await readFile(outputUrl, "utf8").catch(() => "");
    if (current !== generated) {
      process.stderr.write("Generated database contracts are stale. Run bun run generate:database-contracts against the migrated schema.\n");
      process.exitCode = 1;
    } else {
      process.stdout.write("Generated database contracts match the migrated schema.\n");
    }
  } else {
    await writeFile(outputUrl, generated);
    process.stdout.write("Generated Worker database contracts from PostgreSQL.\n");
  }
} finally {
  await client.end();
}
