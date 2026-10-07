import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawn, spawnSync } from 'node:child_process';
import pg from 'pg';
import { resolveWindowsWslDistro } from './wsl.mjs';

const ownerUrl = new URL(process.env.DATABASE_OWNER_URL ?? 'postgresql://novae:novae-local@127.0.0.1:55432/novae');
const adminUrl = new URL(ownerUrl); adminUrl.pathname = '/postgres';
const name = `novae_admin_verify_${process.pid}`;
const fixtureUrl = new URL(ownerUrl); fixtureUrl.pathname = `/${name}`;
const admin = new pg.Client({ connectionString: adminUrl.toString() });
const fixture = new pg.Client({ connectionString: fixtureUrl.toString() });
admin.on('error', () => {}); fixture.on('error', () => {});
const target = '0060_admin_queue_indexes.sql';
const migrations = (await readdir('database/migrations')).filter((file) => /^\d+_.+\.sql$/u.test(file)).sort();
const queries = {
  jobs: { index: 'background_jobs_console_recent_idx', sql: `select id, job_type, status, attempt_count, processed_rows, affected_rows,
    estimated_rows, next_attempt_at, started_at, completed_at, updated_at, last_attempt_id, error_detail
    from app_private.background_jobs order by created_at desc, id desc limit 101` },
  deliveries: { index: 'event_deliveries_console_failed_idx', sql: `select d.id, d.destination, d.attempt_count, d.error_detail, d.last_attempt_id,
    e.event_type, e.aggregate_id, e.operation_id from app_private.event_deliveries d
    join app_private.domain_events e on e.event_id = d.event_id where d.status = 'failed'
    order by d.updated_at desc, d.id desc limit 101` },
  cleanup: { index: 'external_cleanup_console_oldest_idx', sql: `select job_id, created_at, payload
    from app_private.external_cleanup_backlog order by created_at, job_id limit 101` },
  errors: { index: 'operational_errors_console_recent_idx', sql: `select * from app_private.operational_errors
    order by last_at desc, action, code, status limit 101` },
};

async function measure(sql) {
  const times = [];
  let plan;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const result = await fixture.query(`explain (analyze, buffers, format json) ${sql}`);
    plan = result.rows[0]['QUERY PLAN'][0];
    if (attempt > 0) times.push(plan['Execution Time']);
  }
  return { milliseconds: times.sort((a, b) => a - b)[1], sharedBlocks: plan.Plan['Shared Hit Blocks'], plan };
}

const distro = process.platform === 'win32' ? await resolveWindowsWslDistro() : null;
const keepalive = distro ? spawn('wsl.exe', ['-d', distro, '--', 'sh', '-lc', 'while :; do sleep 60; done'],
  { stdio: 'ignore', windowsHide: true }) : null;
let created = false;
try {
  if (!process.env.DATABASE_OWNER_URL) {
    const startup = spawnSync(process.execPath, ['scripts/database.mjs', 'start-local'], { stdio: 'inherit', windowsHide: true });
    assert.equal(startup.status, 0, 'Local PostgreSQL must start before the benchmark');
  }
  await admin.connect();
  await admin.query(`create database ${name}`); created = true;
  await fixture.connect();
  for (const file of migrations.filter((file) => file < target)) await fixture.query(await readFile(`database/migrations/${file}`, 'utf8'));
  await fixture.query(`
    set session_replication_role = replica;
    insert into app_private.background_jobs(job_type, created_at)
      select 'deletion', '2026-01-01'::timestamptz + n * interval '1 second' from generate_series(1,50000) n;
    insert into app_private.domain_events(operation_id, aggregate_type, aggregate_id, event_type, actor_uid)
      select gen_random_uuid(), 'issue', n::text, 'benchmark', 'benchmark' from generate_series(1,50000) n;
    insert into app_private.event_deliveries(event_id, destination, status, last_attempt_id, error_detail, created_at, updated_at)
      select event_id, 'notion', 'failed', gen_random_uuid(), '{}', '2026-01-01',
        '2026-01-01'::timestamptz + row_number() over () * interval '1 second' from app_private.domain_events;
    insert into app_private.external_cleanup_backlog(job_id, payload, created_at)
      select gen_random_uuid(), '{}', '2026-01-01'::timestamptz + n * interval '1 second' from generate_series(1,50000) n;
    insert into app_private.operational_errors(action, code, status, last_at)
      select 'benchmark-' || n, 'benchmark', 500, '2026-01-01'::timestamptz + n * interval '1 second' from generate_series(1,50000) n;
    set session_replication_role = origin;
    analyze;
  `);
  const baseline = {};
  for (const [key, query] of Object.entries(queries)) baseline[key] = {
    measurement: await measure(query.sql), expected: (await fixture.query(query.sql)).rows,
  };
  await fixture.query(await readFile(`database/migrations/${target}`, 'utf8'));
  await fixture.query('analyze');
  for (const [key, query] of Object.entries(queries)) {
    assert.deepEqual((await fixture.query(query.sql)).rows, baseline[key].expected);
    const after = await measure(query.sql);
    assert.ok(JSON.stringify(after.plan).includes(query.index), `Planner must select ${query.index}`);
    const summary = ({ milliseconds, sharedBlocks }) => ({ milliseconds, sharedBlocks });
    console.log(JSON.stringify({ query: key, rowsPerTable: 50000, before: summary(baseline[key].measurement), after: summary(after) }));
  }
} finally {
  await fixture.end().catch(() => undefined);
  await admin.end().catch(() => undefined);
  const cleanup = new pg.Client({ connectionString: adminUrl.toString() });
  try {
    if (created) { await cleanup.connect(); await cleanup.query(`drop database ${name} with (force)`); }
  } finally { await cleanup.end().catch(() => undefined); keepalive?.kill(); }
}
