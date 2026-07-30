import assert from "node:assert/strict";
import { backendActionDefinitions } from "../../supabase/functions/backendAction/action-registry.ts";
import { integrationTest } from "./helpers.ts";

async function readDomainTestSources(directory: URL): Promise<string[]> {
  const sources: string[] = [];
  for await (const entry of Deno.readDir(directory)) {
    const url = new URL(entry.isDirectory ? `${entry.name}/` : entry.name, directory);
    if (entry.isDirectory) {
      sources.push(...await readDomainTestSources(url));
    } else if (
      entry.name !== "action-coverage.test.ts" &&
      /\.(?:case|test)\.ts$/u.test(entry.name)
    ) {
      sources.push(await Deno.readTextFile(url));
    }
  }
  return sources;
}

integrationTest("every registered backend action is exercised by local integration tests", async () => {
  const source = (await readDomainTestSources(new URL("./", import.meta.url))).join("\n");
  const missing = backendActionDefinitions
    .map((definition) => definition.name)
    .filter((actionName) =>
      !new RegExp(`callAction\\(\\s*["']${actionName}["']`, "u").test(source)
    );
  assert.deepEqual(missing, []);
});
