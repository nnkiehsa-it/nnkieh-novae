import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  listFiles,
  moduleImports,
  repoPath,
} from "./helpers.mjs";

const sourceExtensions = /\.(?:ts|tsx)$/u;

async function sourceModules(relativeDir) {
  const files = (await listFiles(relativeDir)).filter((file) =>
    sourceExtensions.test(file.pathname),
  );
  return Promise.all(files.map(async (file) => {
    const path = repoPath(file);
    const source = await readFile(file, "utf8");
    return { imports: moduleImports(source, path), path };
  }));
}

function dependencyViolations(modules, forbidden) {
  return modules.flatMap(({ imports, path }) => imports
    .filter((entry) => forbidden(entry, path))
    .map((entry) => `${path} -> ${entry.specifier}`));
}

test("frontend layers keep service access inside hooks", async () => {
  const app = await sourceModules("src/app");
  const components = await sourceModules("src/components");
  const violations = dependencyViolations(
    [...app, ...components],
    ({ specifier }) => specifier.startsWith("@/services/"),
  );
  assert.deepEqual(violations, []);
});
test("shared UI primitives do not depend on application state or services", async () => {
  const ui = await sourceModules("src/components/ui");
  const violations = dependencyViolations(
    ui,
    ({ specifier }) =>
      specifier.startsWith("@/hooks/") ||
      specifier.startsWith("@/services/"),
  );
  assert.deepEqual(violations, []);
});

test("pure libraries and services do not depend upward on React presentation", async () => {
  const libraries = await sourceModules("src/lib");
  const services = await sourceModules("src/services");
  const libraryViolations = dependencyViolations(
    libraries,
    ({ specifier, typeOnly }) =>
      !typeOnly &&
      (specifier === "react" ||
        specifier.startsWith("@/app/") ||
        specifier.startsWith("@/components/") ||
        specifier.startsWith("@/hooks/")),
  );
  const serviceViolations = dependencyViolations(
    services,
    ({ specifier }) =>
      specifier === "react" ||
      specifier.startsWith("@/app/") ||
      specifier.startsWith("@/components/") ||
      specifier.startsWith("@/hooks/"),
  );
  assert.deepEqual([...libraryViolations, ...serviceViolations], []);
});
