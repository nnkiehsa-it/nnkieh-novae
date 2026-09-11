import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { findOrphanCssClassSelectors } from "./css-orphan-selectors.mjs";

const root = process.cwd();
const sourceRoot = path.join(root, "src");
const errors = [];
const warnings = [];
const moduleLineReviewThreshold = 300;
const moduleLineLimit = 400;
const generatedModules = new Set(["src/services/backend-action-contract.ts"]);

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
const productSourceFiles = [];
const stylesheets = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  const relativePath = path.relative(root, file);

  if (file.endsWith(".css")) {
    stylesheets.push({ path: relativePath.replaceAll(path.sep, "/"), source });
  } else {
    productSources.push(source);
    productSourceFiles.push({ path: relativePath.replaceAll(path.sep, "/"), source });
  }

  if (/\btransition-all\b/u.test(source)) errors.push(`${relativePath} uses transition-all; name the state-changing properties`);
  if (/shadow-\[(?!var\(--shadow-(?:control|card|floating)\))/u.test(source)) errors.push(`${relativePath} defines an arbitrary shadow outside the elevation tokens`);
  if (/\.vue(?:["']|$)|@vue\/|\bvue-tsc\b|\breka-ui\b/u.test(source)) errors.push(`${relativePath} references the retired Vue frontend`);

  if (!file.endsWith(".css")) {
    if (/\bduration:\s*[\d.]/u.test(source)) errors.push(`${relativePath} hard-codes an animation duration; take a rung from @/lib/motion-timing`);
    if (/\bease:\s*\[/u.test(source)) errors.push(`${relativePath} hard-codes an easing curve; take a curve from @/lib/motion-timing`);
    if (/\btype:\s*["']spring["']/u.test(source)) errors.push(`${relativePath} animates on a spring, which sits outside the motion ladder`);
    if (/\bduration-\d/u.test(source)) errors.push(`${relativePath} uses a raw Tailwind duration; reference a motion token instead`);
  }

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

  if (!file.endsWith(".css") && !generatedModules.has(relativePath.replaceAll(path.sep, "/"))) {
    const lineCount = source.split(/\r?\n/u).length;
    if (lineCount > moduleLineLimit) {
      errors.push(`${relativePath} has ${lineCount} lines, over the ${moduleLineLimit}-line limit; split its responsibilities`);
    } else if (lineCount > moduleLineReviewThreshold) {
      warnings.push(`warning: ${relativePath} has ${lineCount} lines; confirm it carries a single responsibility`);
    }
  }
}

for (const orphan of findOrphanCssClassSelectors(stylesheets, productSources)) {
  errors.push(
    `${orphan.locations.join(", ")} defines orphan CSS selector .${orphan.className}`,
  );
}

const globals = await readFile(path.join(sourceRoot, "app/globals.css"), "utf8");
const motion = await readFile(path.join(sourceRoot, "styles/motion.css"), "utf8");
const ladder = await readFile(path.join(sourceRoot, "generated/motion-ladder.css"), "utf8");

// The --motion-* and --ease-* namespaces belong to config/motion.config.json.
// Every rung and curve the product names has to be one the generated ladder
// actually defines, so a retired or mistyped token fails here instead of
// silently resolving to nothing at runtime.
const ladderTokens = new Set(
  [...ladder.matchAll(/(--(?:motion|ease)-[a-z-]+)\s*:/gu)].map(([, token]) => token),
);
for (const { path: consumer, source } of [
  { path: "src/app/globals.css", source: globals },
  { path: "src/styles/motion.css", source: motion },
  ...productSourceFiles,
]) {
  for (const [, token] of source.matchAll(/var\((--(?:motion|ease)-[a-z-]+)\)/gu)) {
    if (!ladderTokens.has(token)) {
      errors.push(`${consumer} names ${token}, which the motion ladder does not define`);
    }
  }
}

// Recipes choose a rung of the ladder; they do not invent their own timing.
const motionRecipes = motion.replace(/^(?::root|\.dark)\s*\{[\s\S]*?^\}/gmu, "");
for (const [literal, amount] of motionRecipes.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)m?s(?![\w-])/gu)) {
  if (Number(amount) === 0) continue;
  errors.push(`src/styles/motion.css hard-codes the duration ${literal}; name it in the motion ladder`);
}
if (!motion.includes("@media (prefers-reduced-motion: reduce)")) errors.push("motion.css must honor prefers-reduced-motion");
if (!motion.includes("@media (hover: hover) and (pointer: fine)")) errors.push("motion.css must gate hover-only feedback");

if (errors.length) {
  console.error([...new Set(errors)].join("\n"));
  process.exit(1);
}

if (warnings.length) console.log([...new Set(warnings)].sort().join("\n"));

console.log(`UI architecture check passed: ${files.length} frontend source files.`);
