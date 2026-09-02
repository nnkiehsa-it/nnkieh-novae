import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;
const root = process.cwd();
const migrationsDirectory = path.join(root, "database", "migrations");
const testDatabase = "novae_migration_upgrade_test";
const ownerUrl = new URL(
  process.env.DATABASE_OWNER_URL
    ?? "postgresql://novae:novae-local@127.0.0.1:55432/novae",
);
const adminUrl = new URL(ownerUrl);
adminUrl.pathname = "/postgres";
const testUrl = new URL(ownerUrl);
testUrl.pathname = `/${testDatabase}`;

const migrationNames = (await readdir(migrationsDirectory, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && /^\d+_[a-z0-9_]+\.sql$/u.test(entry.name))
  .map((entry) => entry.name)
  .sort();
const consistencyMigration = "0016_system_data_consistency.sql";
const bridgeMigrations = [
  "0015_z_quiesce_legacy_projection_triggers.sql",
  "0015_zz_bootstrap_runtime_role.sql",
];
const consistencyIndex = migrationNames.indexOf(consistencyMigration);
if (consistencyIndex < 0) throw new Error(`${consistencyMigration} is missing.`);
if (migrationNames.slice(consistencyIndex - bridgeMigrations.length, consistencyIndex).join() !== bridgeMigrations.join()) {
  throw new Error(`Forward bridges must run immediately before ${consistencyMigration}.`);
}

async function executeMigration(client, name) {
  await client.query("begin");
  try {
    await client.query(await readFile(path.join(migrationsDirectory, name), "utf8"));
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw new Error(`Populated upgrade failed in ${name}.`, { cause: error });
  }
}

const admin = new Client({ connectionString: adminUrl.toString() });
await admin.connect();
try {
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
    [testDatabase],
  );
  await admin.query(`drop database if exists ${testDatabase}`);
  await admin.query(`create database ${testDatabase}`);

  const database = new Client({ connectionString: testUrl.toString() });
  await database.connect();
  try {
    for (const name of migrationNames.slice(0, consistencyIndex)) {
      await executeMigration(database, name);
    }
    await database.query(`
      insert into app_private.issue_categories (
        id, label, read_access, author_visible, support_enabled, comments_enabled,
        is_active, is_default, sort_order, created_by
      ) values (
        'migration-regression', 'Migration regression', 'owner-admin', true,
        false, true, true, true, 0, 'migration-test'
      );
      insert into app_private.issues (
        author_uid, title, content, status, category, read_access, author_visible
      ) values (
        'migration-user', 'Existing issue', 'Existing authoritative content',
        'pending', 'migration-regression', 'owner-admin', true
      );
    `);
    await executeMigration(database, consistencyMigration);
    for (const name of bridgeMigrations) await executeMigration(database, name);
    const result = await database.query(`
      select
        to_regclass('app_private.realtime_events') is null as legacy_realtime_removed,
        (select revision from app_private.issues where category = 'migration-regression') as revision
    `);
    if (!result.rows[0]?.legacy_realtime_removed || Number(result.rows[0]?.revision) < 1) {
      throw new Error("Populated 0016 upgrade did not reach the canonical schema.");
    }
  } finally {
    await database.end();
  }
  console.info("Populated pre-0016 database upgrade passed.");
} finally {
  await admin.query(
    "select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
    [testDatabase],
  ).catch(() => undefined);
  await admin.query(`drop database if exists ${testDatabase}`).catch(() => undefined);
  await admin.end();
}
