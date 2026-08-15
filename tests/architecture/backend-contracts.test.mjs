import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { read, listFiles } from "./helpers.mjs";

test("frontend keeps Firebase limited to Auth, App Check, and FCM", async () => {
  const files = await listFiles("src");
  const source = (await Promise.all(files.filter((file) => /\.(?:ts|tsx)$/u.test(file.pathname)).map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(source, /firebase\/(?:firestore|database|storage)/u);
  assert.match(source, /firebase\/auth/u);
  assert.match(source, /firebase\/app-check/u);
  assert.match(source, /firebase\/messaging/u);
});

test("Vercel hosts the frontend while Cloudflare Workers owns the API", async () => {
  const vercel = JSON.parse(await read("vercel.json"));
  const nextConfig = await read("next.config.mjs");
  const frontendWorkflow = await read(".github/workflows/deploy-frontend.yml");
  const backendWorkflow = await read(".github/workflows/deploy-backend.yml");
  assert.ok(vercel.framework === "nextjs" || nextConfig.includes("nextConfig"));
  assert.match(frontendWorkflow, /vercel(?:@\S+)? deploy/iu);
  assert.match(backendWorkflow, /wrangler deploy/iu);
  assert.match(backendWorkflow, /wrangler hyperdrive update/iu);
  assert.match(backendWorkflow, /db:migrate/u);
  assert.match(backendWorkflow, /configure-cloudinary\.mjs/u);
  assert.doesNotMatch(backendWorkflow, /x-reconcile-config/u);
});

test("production CSP permits WebAssembly image encoding without enabling unsafe eval", async () => {
  const proxy = await read("src/proxy.ts");
  assert.match(proxy, /wasm-unsafe-eval/u);
  assert.match(proxy, /NODE_ENV === "development" \? " 'unsafe-eval'" : ""/u);
});

test("database backups run on a three-day cadence and retain only the latest two artifacts", async () => {
  const backupWorkflow = await read(".github/workflows/backup-database.yml");
  assert.match(backupWorkflow, /259200/u);
  assert.match(backupWorkflow, /postgres:18-alpine/u);
  assert.match(backupWorkflow, /actions: write/u);
  assert.match(backupWorkflow, /artifact_ids\[@\]:2/u);
  assert.match(backupWorkflow, /actions\/artifacts\/\$artifact_id/u);
});

test("the destructive reset workflow resets application data and Cloudinary together", async () => {
  const resetWorkflow = await read(".github/workflows/reset-database-and-cloudinary.yml");
  assert.match(resetWorkflow, /RESET_DATABASE_AND_CLOUDINARY/u);
  assert.match(resetWorkflow, /drop schema if exists app_private cascade/u);
  assert.match(resetWorkflow, /postgres:18-alpine/u);
  assert.match(resetWorkflow, /npm run db:migrate/u);
  assert.match(resetWorkflow, /configure-database-runtime\.mjs/u);
  assert.match(resetWorkflow, /reset-cloudinary\.mjs/u);
  assert.match(resetWorkflow, /configure-cloudinary\.mjs/u);
});

test("backend action registry covers the generated frontend contract", async () => {
  const generated = await read("src/services/backend-action-contract.ts");
  const registry = await read("cloudflare/src/backend/actions/action-registry.ts");
  const entry = await read("cloudflare/src/backend/actions/handler.ts");
  assert.match(generated, /BackendActionName/u);
  assert.match(registry, /backendActionDefinitions/u);
  assert.match(entry, /action/u);
});

test("Postgres is reachable only through the least-privilege Worker boundary", async () => {
  const boundary = await read("database/migrations/0004_worker_database_boundary.sql");
  const runtime = await read("scripts/configure-database-runtime.mjs");
  const worker = await read("cloudflare/src/index.ts");
  assert.match(boundary, /revoke create on schema public from public/iu);
  assert.match(boundary, /revoke all on schema app_private from public/iu);
  assert.match(runtime, /novae_runtime/u);
  assert.match(runtime, /NOINHERIT|noinherit/iu);
  assert.match(runtime, /select code from app_private\.roles limit 1/u);
  assert.doesNotMatch(runtime, /grant create on schema/iu);
  assert.match(worker, /createDatabaseClient/u);
});

test("Cloudflare bindings cover database pooling, jobs, realtime, schedules, and rate limits", async () => {
  const config = await read("cloudflare/wrangler.json");
  const worker = await read("cloudflare/src/index.ts");
  assert.match(config, /hyperdrive/u);
  assert.match(config, /durable_objects/u);
  assert.match(config, /new_sqlite_classes/u);
  assert.match(config, /queues/u);
  assert.match(config, /crons/u);
  assert.match(config, /ratelimits/u);
  assert.match(worker, /async queue/u);
  assert.match(worker, /async scheduled/u);
});

test("announcement comment availability remains a global backend rule", async () => {
  const categories = await read("src/services/categories.ts");
  const announcements = await read("src/services/announcements.ts");
  const backend = await read("cloudflare/src/backend/actions/announcement-comments.ts");
  assert.match(categories, /announcementCommentsEnabled/u);
  assert.match(announcements, /comments/u);
  assert.match(backend, /announcement_comments_enabled|commentsEnabled/u);
});
