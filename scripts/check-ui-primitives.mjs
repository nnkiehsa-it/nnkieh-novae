import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { findOrphanCssClassSelectors } from "./css-orphan-selectors.mjs";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const errors = [];

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (["generated", "i18n"].includes(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath));
    else if (/\.(?:css|ts|tsx)$/u.test(entry.name)) files.push(entryPath);
  }
  return files;
}

const files = await listFiles(sourceRoot);
const productSources = [];
const stylesheets = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  const relativePath = path.relative(root, file);

  if (file.endsWith(".css")) {
    stylesheets.push({ path: relativePath.replaceAll(path.sep, "/"), source });
  } else {
    productSources.push(source);
  }

  if (/\btransition-all\b/u.test(source)) errors.push(`${relativePath} uses transition-all; name the state-changing properties`);
  if (/shadow-\[(?!var\(--shadow-(?:control|card|floating)\))/u.test(source)) errors.push(`${relativePath} defines an arbitrary shadow outside the elevation tokens`);
  if (/\.vue(?:["']|$)|@vue\/|\bvue-tsc\b|\breka-ui\b/u.test(source)) errors.push(`${relativePath} references the retired Vue frontend`);

  if (file.endsWith(".css")) {
    const hoverBlocks = [...source.matchAll(/([^{}]+:hover[^{}]*)\{[^{}]*\}/gu)];
    for (const block of hoverBlocks) {
      const before = source.slice(0, block.index);
      const mediaStart = before.lastIndexOf("@media");
      const mediaSource = mediaStart >= 0 ? before.slice(mediaStart, before.indexOf("{", mediaStart) + 1) : "";
      if (!/\(hover:\s*hover\)/u.test(mediaSource)) errors.push(`${relativePath} has an ungated :hover selector`);
    }
  }

  if (relativePath.includes(`${path.sep}components${path.sep}ui${path.sep}`) && /@\/(?:services|hooks\/use-session)/u.test(source)) {
    errors.push(`${relativePath} imports business data into a UI primitive`);
  }

  if (
    (relativePath.includes(`${path.sep}app${path.sep}`) ||
      relativePath.includes(`${path.sep}components${path.sep}`)) &&
    /from\s+["']@\/services\//u.test(source)
  ) {
    errors.push(`${relativePath} accesses a service directly; move the flow into a domain hook`);
  }

  if (relativePath.includes(`${path.sep}app${path.sep}`) && relativePath.endsWith(`${path.sep}page.tsx`)) {
    const lineCount = source.split(/\r?\n/u).length;
    if (lineCount > 220) errors.push(`${relativePath} has ${lineCount} lines; split route responsibilities into hooks and domain components`);
  }

  if (
    relativePath.includes(`${path.sep}components${path.sep}`) &&
    !relativePath.includes(`${path.sep}components${path.sep}ui${path.sep}`)
  ) {
    const lineCount = source.split(/\r?\n/u).length;
    if (lineCount > 300) errors.push(`${relativePath} has ${lineCount} lines; split domain presentation into focused components`);
  }
}

for (const orphan of findOrphanCssClassSelectors(stylesheets, productSources)) {
  errors.push(
    `${orphan.locations.join(", ")} defines orphan CSS selector .${orphan.className}`,
  );
}

const globals = await readFile(path.join(sourceRoot, "app/globals.css"), "utf8");
const motion = await readFile(path.join(sourceRoot, "styles/motion.css"), "utf8");
for (const token of ["--background", "--card", "--border", "--radius", "--shadow-control", "--shadow-card", "--shadow-floating"]) {
  if (!globals.includes(token)) errors.push(`src/app/globals.css is missing ${token}`);
}
for (const token of ["--motion-micro", "--motion-fast", "--motion-medium", "--motion-emphasis", "--ease-smooth-out"]) {
  if (!motion.includes(token)) errors.push(`src/styles/motion.css is missing ${token}`);
}
if (!motion.includes("@media (prefers-reduced-motion: reduce)")) errors.push("motion.css must honor prefers-reduced-motion");
if (!motion.includes("@media (hover: hover) and (pointer: fine)")) errors.push("motion.css must gate hover-only feedback");

if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  process.exit(1);
}

console.log(`UI architecture check passed: ${files.length} frontend source files.`);
