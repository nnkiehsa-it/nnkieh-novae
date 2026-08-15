import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { listFiles, moduleImports, repoPath } from "./helpers.mjs";

const databaseModules = new Set([
  "@neondatabase/serverless",
  "firebase/database",
  "firebase/firestore",
  "firebase/storage",
  "pg",
]);

test("browser source cannot import database clients", async () => {
  const files = (await listFiles("src")).filter((file) =>
    /\.(?:ts|tsx)$/u.test(file.pathname),
  );
  const violations = [];
  for (const file of files) {
    const path = repoPath(file);
    const imports = moduleImports(await readFile(file, "utf8"), path);
    for (const { specifier } of imports) {
      if (databaseModules.has(specifier)) violations.push(`${path} -> ${specifier}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("database schema ownership stays outside frontend source", async () => {
  const frontendFiles = (await listFiles("src")).map(repoPath);
  assert.equal(frontendFiles.some((path) => /(?:migration|schema)\.sql$/u.test(path)), false);
  assert.ok((await listFiles("database/migrations")).some((file) => file.pathname.endsWith(".sql")));
});
