import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { backendActionDefinitions } from "../../cloudflare/src/backend/actions/action-registry.ts";
import { integrationTest } from "./helpers.ts";

async function readDomainTestSources(directory: string): Promise<string[]> {
  const sources: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      sources.push(...await readDomainTestSources(path));
    } else if (
      entry.name !== "action-coverage.test.ts" &&
      /\.(?:case|test)\.ts$/u.test(entry.name)
    ) {
      sources.push(await readFile(path, "utf8"));
    }
  }
  return sources;
}

integrationTest("every registered backend action is exercised by local integration tests", async () => {
  const source = (await readDomainTestSources(dirname(fileURLToPath(import.meta.url)))).join("\n");
  const missing = backendActionDefinitions
    .map((definition) => definition.name)
    .filter((actionName) =>
      !new RegExp(`callAction\\(\\s*["']${actionName}["']`, "u").test(source)
    );
  assert.deepEqual(missing, []);
});
