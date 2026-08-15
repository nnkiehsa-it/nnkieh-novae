import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import test from "node:test";
import { moduleImports, repoPath } from "./helpers.mjs";

const workerEntryModules = [
  "cloudflare/src/backend/actions/handler.ts",
  "cloudflare/src/backend/sync-user.ts",
  "cloudflare/src/backend/cloudinary-webhook.ts",
  "cloudflare/src/backend/jobs/outbox.ts",
  "cloudflare/src/backend/jobs/deletion.ts",
  "cloudflare/src/backend/jobs/realtime.ts",
  "cloudflare/src/backend/jobs/maintenance.ts",
];

test("Worker entry modules depend on the shared observability boundary", async () => {
  const violations = [];
  for (const path of workerEntryModules) {
    const file = new URL(`../../${path}`, import.meta.url);
    const imports = moduleImports(await readFile(file, "utf8"), repoPath(file));
    if (!imports.some(({ specifier }) => specifier.endsWith("/shared/observability.ts"))) {
      violations.push(path);
    }
  }
  assert.deepEqual(violations, []);
});
