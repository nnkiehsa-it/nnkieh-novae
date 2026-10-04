import { access, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import configuredLimits from "../config/build-budget.config.json" with { type: "json" };
import { measureCss, measureRouteCss, readClientManifest } from "./build-budget-metrics.mjs";

const buildDirectory = path.resolve(process.env.NOVAE_NEXT_DIST_DIR || ".next");
const staticDirectory = path.join(buildDirectory, "static");

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const name = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(name));
    else files.push({ name, size: (await stat(name)).size });
  }
  return files;
}

try {
  await access(staticDirectory);
} catch {
  throw new Error(`Build output not found at ${staticDirectory}. Run a production build before checking the asset budget.`);
}

const assets = await listFiles(staticDirectory);
const bytesFor = (extension) => assets.filter((asset) => asset.name.endsWith(extension)).reduce((total, asset) => total + asset.size, 0);
const cssAssets = new Map(await Promise.all(assets.filter((asset) => asset.name.endsWith(".css")).map(async ({ name }) => [
  path.relative(buildDirectory, name).split(path.sep).join("/"),
  measureCss(await readFile(name, "utf8")),
])));
const manifests = (await listFiles(path.join(buildDirectory, "server", "app")))
  .filter(({ name }) => name.endsWith("_client-reference-manifest.js"));
if (!manifests.length) throw new Error("No Next.js client reference manifests found; route CSS budgets cannot be measured.");
const routePaths = JSON.parse(await readFile(path.join(buildDirectory, "app-path-routes-manifest.json"), "utf8"));
const routes = await Promise.all(manifests.map(async ({ name }) => {
  const manifest = readClientManifest(await readFile(name, "utf8"));
  return { ...measureRouteCss(manifest, cssAssets), pathname: routePaths[manifest.route] };
}));
routes.sort((a, b) => b.gzipBytes - a.gzipBytes);

const actual = {
  maxRouteCssUiBytes: Math.max(...routes.map((route) => route.uiBytes)),
  maxRouteCssGzipBytes: Math.max(...routes.map((route) => route.gzipBytes)),
  // Also guards styles loaded on demand, such as the Markdown editor.
  maxCssChunkGzipBytes: Math.max(...[...cssAssets.values()].map((asset) => asset.gzipBytes)),
  cssFontFaceBytes: [...cssAssets.values()].reduce((total, asset) => total + asset.fontFaceBytes, 0),
  fontBytes: bytesFor(".woff2"),
  jsBytes: bytesFor(".js"),
};
const limits = { ...configuredLimits };
const environmentOverrides = {
  maxRouteCssUiBytes: "NOVAE_ROUTE_CSS_UI_BUDGET_BYTES",
  maxRouteCssGzipBytes: "NOVAE_ROUTE_CSS_GZIP_BUDGET_BYTES",
  maxCssChunkGzipBytes: "NOVAE_CSS_CHUNK_GZIP_BUDGET_BYTES",
  cssFontFaceBytes: "NOVAE_FONT_FACE_CSS_BUDGET_BYTES",
  fontBytes: "NOVAE_FONT_BUDGET_BYTES",
  jsBytes: "NOVAE_JS_BUDGET_BYTES",
};
if (process.env.NOVAE_CSS_BUDGET_BYTES) {
  throw new Error("NOVAE_CSS_BUDGET_BYTES was replaced by the route UI, route gzip and font-face CSS budgets. Update the environment override.");
}
for (const [metric, variable] of Object.entries(environmentOverrides)) {
  if (process.env[variable] === undefined) continue;
  const value = Number(process.env[variable]);
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${variable} must be a positive byte count.`);
  limits[metric] = value;
}

const reportPath = path.join(buildDirectory, "build-budget-report.json");
const inventory = { cssBytes: bytesFor(".css"), fontFiles: assets.filter((asset) => asset.name.endsWith(".woff2")).length };
await writeFile(reportPath, `${JSON.stringify({ actual, limits, inventory, routes, cssAssets: Object.fromEntries(cssAssets) }, null, 2)}\n`);
const kib = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;
console.info(`CSS inventory: ${kib(inventory.cssBytes)} raw; ${kib(actual.cssFontFaceBytes)} font declarations.`);
console.info(`Largest initial route CSS: ${kib(actual.maxRouteCssUiBytes)} UI raw; ${kib(actual.maxRouteCssGzipBytes)} gzip estimate (including fonts).`);
for (const route of routes.slice(0, 3)) console.info(`  ${route.pathname}: ${kib(route.gzipBytes)} gzip estimate, ${route.files.length} CSS assets`);
console.info(`Report: ${reportPath}`);

const exceeded = Object.entries(limits).filter(([metric, limit]) => actual[metric] > limit).map(([metric, limit]) => `${metric}: ${actual[metric]} > ${limit}`);
if (exceeded.length) throw new Error(`Build budget exceeded:\n${exceeded.join("\n")}\nSee ${reportPath} for affected routes and assets.`);
const warnings = Object.entries(limits).filter(([metric, limit]) => actual[metric] >= limit * 0.85).map(([metric, limit]) => `${metric}: ${actual[metric]} / ${limit}`);
if (warnings.length) console.warn(`Build budget warning (>=85%):\n${warnings.join("\n")}`);
console.info(`Build budget passed: ${inventory.fontFiles} fonts, ${kib(actual.fontBytes)} font inventory, ${kib(actual.jsBytes)} JS inventory.`);
