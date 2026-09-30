import assert from "node:assert/strict";
import test from "node:test";
import { read } from "../architecture/helpers.mjs";

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

test("local and CI verification share one generated-artifact drift gate", async () => {
  const localVerification = await read("scripts/run-local-verification.mjs");
  const workflow = await read(".github/workflows/verify-and-deploy.yml");
  assert.match(workflow, /bun run verify:fast/u);
  assert.doesNotMatch(workflow, /bun run verify:generated/u);
  assert.match(localVerification, /scripts\/verify-generated\.mjs/u);
});

test("CI cache policy stays bounded", async () => {
  const workflow = await read(".github/workflows/verify-and-deploy.yml");
  assert.match(workflow, /path: \.next\/cache/u);
  assert.match(workflow, /path: ~\/\.cache\/firebase\/emulators/u);
  assert.doesNotMatch(workflow, /path: (?:node_modules|\.next\s*$)/mu);
});

test("deployed builds disable local authentication and smoke-test primary entry routes", async () => {
  const workflow = await read(".github/workflows/verify-and-deploy.yml");
  const build = workflow.split("- name: Build Project Artifacts")[1].split("- name: Deploy Project Artifacts")[0];
  assert.match(build, /NEXT_PUBLIC_LOCAL_DEV_AUTH: 'false'/u);
  assert.match(build, /NEXT_PUBLIC_LOCAL_TEST_ORIGIN: ''/u);
  assert.match(build, /NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: ''/u);
  assert.match(build, /NOVAE_LOCAL_TEST_PREVIEW: 'false'/u);
  assert.match(workflow, /for route in login home feed/u);
});
