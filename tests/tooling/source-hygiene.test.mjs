import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { listFiles, moduleImports, repoPath } from "../architecture/helpers.mjs";

function resolveFrontendImport(fromPath, specifier, knownPaths) {
  const basePath = specifier.startsWith("@/")
    ? `src/${specifier.slice(2)}`
    : specifier.startsWith(".")
      ? path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier))
      : null;
  if (!basePath) return null;
  return [`${basePath}.ts`, `${basePath}.tsx`, `${basePath}/index.ts`, `${basePath}/index.tsx`]
    .find((candidate) => knownPaths.has(candidate)) ?? null;
}

test("shared frontend runtime modules have a product consumer", async () => {
  const files = (await listFiles("src")).filter((file) => /\.(?:ts|tsx)$/u.test(file.pathname));
  const modules = await Promise.all(files.map(async (file) => {
    const modulePath = repoPath(file);
    return { imports: moduleImports(await readFile(file, "utf8"), modulePath), path: modulePath };
  }));
  const knownPaths = new Set(modules.map(({ path: modulePath }) => modulePath));
  const importedPaths = new Set(modules.flatMap(({ imports, path: modulePath }) => imports
    .map(({ specifier }) => resolveFrontendImport(modulePath, specifier, knownPaths))
    .filter(Boolean)));
  const prefixes = ["src/components/", "src/hooks/", "src/lib/", "src/services/"];
  const orphaned = modules.map(({ path: modulePath }) => modulePath)
    .filter((modulePath) => prefixes.some((prefix) => modulePath.startsWith(prefix)))
    .filter((modulePath) => !modulePath.endsWith(".d.ts"))
    .filter((modulePath) => !importedPaths.has(modulePath));
  assert.deepEqual(orphaned, []);
});
