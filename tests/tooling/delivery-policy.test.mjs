import assert from "node:assert/strict";
import test from "node:test";
import { listFiles, read, repoPath } from "../architecture/helpers.mjs";

test("runtime and framework versions remain pinned to the supported platform", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.equal((await read(".node-version")).trim(), "24");
  assert.equal((await read(".nvmrc")).trim(), "24");
  assert.equal(packageJson.packageManager, "bun@1.4.0");
  assert.match(packageJson.engines.bun, /^>=1\.4/u);
  assert.match(packageJson.engines.node, /^>=24/u);
  assert.match(packageJson.dependencies.next, /^16\./u);
  assert.match(packageJson.dependencies.react, /^19\./u);
  assert.equal(packageJson.devDependencies.typescript, "7.0.2");
});

test("Bun is the sole package-management entry point", async () => {
  const vercel = JSON.parse(await read("vercel.json"));
  await assert.rejects(() => read("package-lock.json"));
  await read("bun.lock");
  assert.equal(vercel.installCommand, "bun install --frozen-lockfile");
  for (const workflowPath of [
    ".github/workflows/verify-pr.yml",
    ".github/workflows/deploy-frontend.yml",
    ".github/workflows/deploy-backend.yml",
    ".github/workflows/reset-database-and-cloudinary.yml",
  ]) {
    const workflow = await read(workflowPath);
    assert.match(workflow, /oven-sh\/setup-bun@v2/u);
    assert.match(workflow, /bun install --frozen-lockfile/u);
    assert.doesNotMatch(workflow, /\b(?:npm|npx)\b/u);
  }
});

test("package scripts expose required verification and deployment commands", async () => {
  const scripts = JSON.parse(await read("package.json")).scripts;
  for (const name of ["build", "check:ui", "check:worker", "verify:local", "verify:integration", "verify:all", "test:e2e"])
    assert.equal(typeof scripts[name], "string", `missing package script ${name}`);
});

test("delivery entry points remain in their platform directories", async () => {
  const paths = [...(await listFiles(".github/workflows")), ...(await listFiles("scripts"))].map(repoPath);
  for (const required of [
    ".github/workflows/deploy-frontend.yml",
    ".github/workflows/deploy-backend.yml",
    "scripts/run-local-verification.mjs",
    "scripts/verify-integration.mjs",
    "scripts/render-worker-config.mjs",
  ]) assert.ok(paths.includes(required), `missing delivery entry point ${required}`);
});

test("CI cache policy stays bounded", async () => {
  const verify = await read(".github/workflows/verify-pr.yml");
  const frontend = await read(".github/workflows/deploy-frontend.yml");
  const backend = await read(".github/workflows/deploy-backend.yml");
  assert.match(verify, /path: \.next\/cache/u);
  assert.match(frontend, /path: \.next\/cache/u);
  assert.match(verify, /path: ~\/\.cache\/firebase\/emulators/u);
  assert.match(backend, /path: ~\/\.cache\/firebase\/emulators/u);
  for (const workflow of [verify, frontend, backend])
    assert.doesNotMatch(workflow, /path: (?:node_modules|\.next\s*$)/mu);
});
