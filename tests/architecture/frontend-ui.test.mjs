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
