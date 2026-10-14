import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { ACTIONS } from "../../shared/actions.ts";

// The map stops on any action, policy or source it no longer explains, so
// building it is how drift between the code and the map is caught.
test("the project map builds against the current contracts and sources", () => {
  const directory = mkdtempSync(join(tmpdir(), "novae-project-map-"));
  try {
    const output = execFileSync(process.execPath, ["tools/project-map/build.mjs", join(directory, "map.html")], { encoding: "utf8" });
    const summary = JSON.parse(output);
    assert.equal(summary.actions, Object.keys(ACTIONS).length);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
