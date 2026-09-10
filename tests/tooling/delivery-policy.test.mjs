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
