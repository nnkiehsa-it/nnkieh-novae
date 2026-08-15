import assert from "node:assert/strict";
import test from "node:test";
import { listFiles, read, repoPath } from "./helpers.mjs";

test("runtime and framework versions remain pinned to the supported platform", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  assert.equal((await read(".node-version")).trim(), "24");
  assert.equal((await read(".nvmrc")).trim(), "24");
  assert.match(packageJson.engines.node, /^>=24/u);
  assert.match(packageJson.dependencies.next, /^16\./u);
  assert.match(packageJson.dependencies.react, /^19\./u);
  assert.equal(packageJson.devDependencies.typescript, "7.0.2");
});

test("package scripts expose the required verification and deployment boundaries", async () => {
  const scripts = JSON.parse(await read("package.json")).scripts;
  for (const name of [
    "build",
    "check:ui",
    "check:worker",
    "verify:local",
    "verify:integration",
    "verify:all",
    "test:e2e",
  ]) assert.equal(typeof scripts[name], "string", `missing package script ${name}`);
});

test("delivery entry points remain owned by their platform directories", async () => {
  const paths = [
    ...(await listFiles(".github/workflows")),
    ...(await listFiles("scripts")),
  ].map(repoPath);
  for (const required of [
    ".github/workflows/deploy-frontend.yml",
    ".github/workflows/deploy-backend.yml",
    "scripts/run-local-verification.mjs",
    "scripts/verify-integration.mjs",
    "scripts/render-worker-config.mjs",
  ]) assert.ok(paths.includes(required), `missing delivery entry point ${required}`);
});
