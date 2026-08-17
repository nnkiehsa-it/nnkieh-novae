import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  listFiles,
  moduleImports,
  repoPath,
} from "./helpers.mjs";
import { findOrphanCssClassSelectors } from "../../scripts/css-orphan-selectors.mjs";

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

function resolveFrontendImport(fromPath, specifier, knownPaths) {
  const basePath = specifier.startsWith("@/")
    ? `src/${specifier.slice(2)}`
    : specifier.startsWith(".")
      ? path.posix.normalize(path.posix.join(path.posix.dirname(fromPath), specifier))
      : null;
  if (!basePath) return null;
  return [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}/index.ts`,
    `${basePath}/index.tsx`,
  ].find((candidate) => knownPaths.has(candidate)) ?? null;
}

test("primary App Router entry points remain present", async () => {
  const paths = (await listFiles("src/app")).map(repoPath);
  for (const route of [
    "src/app/login/page.tsx",
    "src/app/(protected)/setup/page.tsx",
    "src/app/(protected)/issues/[filter]/page.tsx",
    "src/app/(protected)/issues/[filter]/new/page.tsx",
    "src/app/(protected)/issues/[filter]/[issueId]/page.tsx",
    "src/app/(protected)/facilities/page.tsx",
    "src/app/(protected)/facilities/new/page.tsx",
    "src/app/(protected)/facilities/[facilityId]/page.tsx",
    "src/app/(protected)/announcements/page.tsx",
    "src/app/(protected)/announcements/new/page.tsx",
    "src/app/(protected)/announcements/[announcementId]/page.tsx",
    "src/app/(protected)/notifications/page.tsx",
    "src/app/(protected)/settings/page.tsx",
    "src/app/(protected)/dashboard/page.tsx",
    "src/app/(protected)/admin/management/page.tsx",
  ]) assert.ok(paths.includes(route), `missing route ${route}`);
});

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

test("shared frontend runtime modules have a product consumer", async () => {
  const modules = await sourceModules("src");
  const knownPaths = new Set(modules.map(({ path: modulePath }) => modulePath));
  const importedPaths = new Set(modules.flatMap(({ imports, path: modulePath }) =>
    imports
      .map(({ specifier }) => resolveFrontendImport(modulePath, specifier, knownPaths))
      .filter(Boolean),
  ));
  const sharedRuntimePrefixes = [
    "src/components/",
    "src/hooks/",
    "src/lib/",
    "src/services/",
  ];
  const orphaned = modules
    .map(({ path: modulePath }) => modulePath)
    .filter((modulePath) => sharedRuntimePrefixes.some((prefix) => modulePath.startsWith(prefix)))
    .filter((modulePath) => !modulePath.endsWith(".d.ts"))
    .filter((modulePath) => !importedPaths.has(modulePath));

  assert.deepEqual(orphaned, []);
});

test("CSS orphan analysis ignores keyframe percentages and matches whole class tokens", () => {
  const orphans = findOrphanCssClassSelectors(
    [{
      path: "fixture.css",
      source: `
        .used.unused { opacity: 1; }
        .used-longer { opacity: 0; }
        @keyframes shake { 28.57% { transform: none; } }
      `,
    }],
    ['<div className="used used-longer" />'],
  );

  assert.deepEqual(orphans, [{
    className: "unused",
    locations: ["fixture.css:2"],
  }]);
});
