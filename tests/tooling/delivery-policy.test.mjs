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
    ".github/workflows/verify-and-deploy.yml",
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
  for (const name of ["build", "check:ui", "check:worker", "verify:generated", "verify:local", "verify:integration", "verify:all", "test:e2e"])
    assert.equal(typeof scripts[name], "string", `missing package script ${name}`);
});

test("local and CI verification share the generated-artifact drift gate", async () => {
  const localVerification = await read("scripts/run-local-verification.mjs");
  const workflow = await read(".github/workflows/verify-and-deploy.yml");
  assert.match(localVerification, /scripts\/verify-generated\.mjs/u);
  assert.match(workflow, /bun run verify:generated/u);
});

test("verification and deployment share one dependency-gated workflow", async () => {
  const workflow = await read(".github/workflows/verify-and-deploy.yml");
  assert.match(workflow, /backend_verify:/u);
  assert.match(workflow, /browser_verify:/u);
  assert.match(workflow, /deploy_backend:/u);
  assert.match(workflow, /frontend_build:/u);
  assert.match(workflow, /deploy_frontend:/u);
  assert.match(workflow, /actions\/upload-artifact@v4/u);
  assert.match(workflow, /actions\/download-artifact@v4/u);
  assert.doesNotMatch(workflow, /Wait for verification|gh run list/u);
});

test("delivery entry points remain in their platform directories", async () => {
  const paths = [...(await listFiles(".github/workflows")), ...(await listFiles("scripts"))].map(repoPath);
  for (const required of [
    ".github/workflows/verify-and-deploy.yml",
    "scripts/run-local-verification.mjs",
    "scripts/verify-integration.mjs",
    "scripts/render-worker-config.mjs",
  ]) assert.ok(paths.includes(required), `missing delivery entry point ${required}`);
});

test("CI cache policy stays bounded", async () => {
  const workflow = await read(".github/workflows/verify-and-deploy.yml");
  assert.match(workflow, /path: \.next\/cache/u);
  assert.match(workflow, /path: ~\/\.cache\/firebase\/emulators/u);
  assert.doesNotMatch(workflow, /path: (?:node_modules|\.next\s*$)/mu);
});
