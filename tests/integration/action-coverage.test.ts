import assert from "node:assert/strict";
import { backendActionDefinitions } from "../../supabase/functions/backendAction/action-registry.ts";
import { integrationTest } from "./helpers.ts";

integrationTest("every registered backend action is exercised by local integration tests", async () => {
  const testFiles = [
    "access-uploads.test.ts",
    "issues.test.ts",
    "facilities-announcements.test.ts",
    "notifications-workers-security.test.ts",
  ];
  const source = (await Promise.all(testFiles.map((file) =>
    Deno.readTextFile(new URL(file, import.meta.url))
  ))).join("\n");
  const missing = backendActionDefinitions
    .map((definition) => definition.name)
    .filter((actionName) =>
      !new RegExp(`callAction\\(\\s*["']${actionName}["']`, "u").test(source)
    );
  assert.deepEqual(missing, []);
});
