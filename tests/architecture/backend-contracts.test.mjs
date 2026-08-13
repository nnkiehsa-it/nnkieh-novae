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

test("Vercel remains frontend hosting while Supabase owns backend deployment", async () => {
  const vercel = JSON.parse(await read("vercel.json"));
  const nextConfig = await read("next.config.mjs");
  const workflows = (await Promise.all((await listFiles(".github/workflows")).map((file) => readFile(file, "utf8")))).join("\n");
  assert.ok(vercel.framework === "nextjs" || nextConfig.includes("nextConfig"));
  assert.doesNotMatch(JSON.stringify(vercel), /supabase functions deploy/u);
  assert.match(workflows, /supabase db push|supabase functions deploy/u);
});

test("backend action registry covers the generated frontend contract", async () => {
  const generated = await read("src/services/backend-action-contract.ts");
  const registry = await read("supabase/functions/backendAction/action-registry.ts");
  const entry = await read("supabase/functions/backendAction/index.ts");
  assert.match(generated, /BackendActionName/u);
  assert.match(registry, /backendActionDefinitions/u);
  assert.match(entry, /action/u);
});

test("RLS, auth helpers, outbox, deletion, and retention stay server owned", async () => {
  const migrations = (await Promise.all((await listFiles("supabase/migrations")).map((file) => readFile(file, "utf8")))).join("\n");
  const functions = (await Promise.all((await listFiles("supabase/functions")).map((file) => readFile(file, "utf8")))).join("\n");
  assert.match(migrations, /enable row level security/iu);
  assert.match(migrations, /firebase_uid|current_user/iu);
  assert.match(functions, /outbox/u);
  assert.match(functions, /deletion/u);
  assert.match(functions, /retention|cleanup/u);
});

test("announcement comment availability remains a global backend rule", async () => {
  const categories = await read("src/services/categories.ts");
  const announcements = await read("src/services/announcements.ts");
  const backend = await read("supabase/functions/backendAction/announcement-comments.ts");
  assert.match(categories, /announcementCommentsEnabled/u);
  assert.match(announcements, /comments/u);
  assert.match(backend, /announcement_comments_enabled|commentsEnabled/u);
});
