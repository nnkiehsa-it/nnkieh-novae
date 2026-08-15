import assert from "node:assert/strict";
import test from "node:test";
import { read } from "./helpers.mjs";

test("delivery tooling targets Node 24 and Next.js 16", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const nodeVersion = (await read(".node-version")).trim();
  const nvmVersion = (await read(".nvmrc")).trim();
  assert.equal(nodeVersion, "24");
  assert.equal(nvmVersion, "24");
  assert.match(packageJson.engines.node, /^>=24/u);
  assert.match(packageJson.dependencies.next, /^16\./u);
  assert.match(packageJson.dependencies.react, /^19\./u);
  assert.equal(packageJson.devDependencies.typescript, "7.0.2");
  assert.match(packageJson.scripts.dev, /^next dev(?: --webpack)?$/u);
  assert.match(packageJson.scripts.build, /next build --webpack/u);
});

test("local verification runs contracts, Next build, tests, audit, Worker checks, integration, and E2E", async () => {
  const runner = await read("scripts/run-local-verification.mjs");
  assert.match(runner, /executable\("tsc"\)/u);
  assert.match(runner, /executable\("next"\)/u);
  assert.match(runner, /"build", "--webpack"/u);
  assert.match(runner, /Cloudflare Worker types/u);
  assert.match(runner, /unit tests/u);
  assert.match(runner, /architecture tests/u);
  assert.match(runner, /dependency audit/u);
  assert.match(runner, /Integration verification/u);
  assert.match(runner, /End-to-end verification/u);
});

test("PWA delivery uses Serwist and an App Router service worker", async () => {
  const nextConfig = await read("next.config.mjs");
  const worker = await read("src/app/sw.ts");
  const manifest = await read("src/app/manifest.ts");
  assert.match(nextConfig, /withSerwist/u);
  assert.match(worker, /defaultCache/u);
  assert.match(worker, /Serwist/u);
  assert.match(worker, /notificationclick/u);
  assert.match(manifest, /display: "standalone"/u);
});

test("integration and E2E share the isolated Postgres, Worker, and Firebase harness", async () => {
  const packageJson = JSON.parse(await read("package.json"));
  const integration = await read("scripts/verify-integration.mjs");
  const playwright = await read("playwright.config.ts");
  assert.match(packageJson.scripts["verify:all"], /--all/u);
  assert.match(integration, /integration\.invalid/u);
  assert.match(integration, /NEXT_PUBLIC_LOCAL_DEV_AUTH/u);
  assert.match(integration, /wrangler/u);
  assert.match(integration, /database\.mjs/u);
  assert.match(integration, /--e2e/u);
  assert.match(playwright, /tests\/e2e/u);
  assert.match(playwright, /chromium/u);
});
