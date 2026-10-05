import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { realpathSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const require = createRequire(import.meta.url);
const { getRootDirs } = require("@next/eslint-plugin-next/dist/utils/get-root-dirs.js");

test("Next lint loads the local Node glob replacement", () => {
  const nextRequire = createRequire(require.resolve("@next/eslint-plugin-next"));
  assert.equal(
    realpathSync(nextRequire.resolve("fast-glob")),
    realpathSync(fileURLToPath(new URL("../../tools/next-root-glob/index.mjs", import.meta.url))),
  );
});

test("Next lint still resolves exact, wildcard, brace and array project roots", async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), "novae-next-root-glob-"));
  const root = fixture.replaceAll("\\", "/");
  const target = path.resolve(fixture);
  if (!target.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(target).startsWith("novae-next-root-glob-")) {
    throw new Error("Unsafe test fixture cleanup path.");
  }
  try {
    await mkdir(path.join(fixture, "apps/a/nested"), { recursive: true });
    await mkdir(path.join(fixture, "apps/b"), { recursive: true });
    const context = (rootDir) => ({ cwd: fixture, settings: { next: { rootDir } } });
    assert.deepEqual(getRootDirs(context(undefined)), [fixture]);
    assert.deepEqual(getRootDirs(context(`${root}/apps/a`)), [`${root}/apps/a`]);
    for (const pattern of [`${root}/apps/*`, `${root}/apps/{a,b}`, [`${root}/apps/a`, `${root}/apps/b`]]) {
      assert.deepEqual(getRootDirs(context(pattern)).sort(), [`${root}/apps/a`, `${root}/apps/b`]);
    }
  } finally {
    await rm(target, { recursive: true });
  }
});
