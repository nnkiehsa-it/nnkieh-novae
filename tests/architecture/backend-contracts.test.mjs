import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  listFiles,
  moduleImports,
  read,
  repoPath,
} from "./helpers.mjs";

test("frontend Firebase usage remains limited to identity, App Check, and messaging", async () => {
  const files = (await listFiles("src")).filter((file) => /\.(?:ts|tsx)$/u.test(file.pathname));
  const firebaseImports = new Set();
  for (const file of files) {
    const path = repoPath(file);
    for (const { specifier } of moduleImports(await readFile(file, "utf8"), path)) {
      if (specifier.startsWith("firebase/")) firebaseImports.add(specifier);
    }
  }
  const allowed = new Set([
    "firebase/app",
    "firebase/app-check",
    "firebase/auth",
    "firebase/messaging",
    // The service worker's half of messaging.
    "firebase/messaging/sw",
  ]);
  assert.deepEqual([...firebaseImports].filter((specifier) => !allowed.has(specifier)), []);
});

test("Cloudflare backend cannot depend on frontend modules", async () => {
  const files = (await listFiles("cloudflare/src")).filter((file) => /\.ts$/u.test(file.pathname));
  const violations = [];
  for (const file of files) {
    const path = repoPath(file);
    for (const { specifier } of moduleImports(await readFile(file, "utf8"), path)) {
      if (specifier.startsWith("@/") || specifier.includes("/src/app/") || specifier.includes("/src/features/")) {
        violations.push(`${path} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(violations, []);
});

test("hosting configuration keeps frontend and API ownership separate", async () => {
  const vercel = JSON.parse(await read("vercel.json"));
  const wrangler = JSON.parse(await read("cloudflare/wrangler.json"));
  assert.equal(vercel.framework, "vite");
  assert.equal(vercel.outputDirectory, "dist");
  // The static app answers every path with its shell; the API lives elsewhere.
  assert.deepEqual(vercel.rewrites, [{ source: "/((?!assets/).*)", destination: "/index.html" }]);
  assert.equal(wrangler.main, "src/index.ts");
  assert.ok(Array.isArray(wrangler.hyperdrive) && wrangler.hyperdrive.length > 0);
  assert.ok(Array.isArray(wrangler.durable_objects?.bindings));
  assert.ok(Array.isArray(wrangler.queues?.consumers));
});
