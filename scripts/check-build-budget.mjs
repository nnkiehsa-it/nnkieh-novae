import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";

const staticDirectory = path.resolve(
  process.env.NOVAE_NEXT_DIST_DIR || ".next",
  "static",
);

function limitFromEnvironment(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath));
    else files.push({ name: entryPath, size: (await stat(entryPath)).size });
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
const actual = {
  cssBytes: bytesFor(".css"),
  fontBytes: bytesFor(".woff2"),
  fontFiles: assets.filter((asset) => asset.name.endsWith(".woff2")).length,
  jsBytes: bytesFor(".js"),
};
const limits = {
  cssBytes: limitFromEnvironment("NOVAE_CSS_BUDGET_BYTES", 768 * 1024),
  // Traditional Chinese font subsetting intentionally produces many small shards.
  fontBytes: limitFromEnvironment("NOVAE_FONT_BUDGET_BYTES", 8 * 1024 * 1024),
  jsBytes: limitFromEnvironment("NOVAE_JS_BUDGET_BYTES", 3 * 1024 * 1024),
};
const exceeded = Object.entries(limits).filter(([metric, limit]) => actual[metric] > limit).map(([metric, limit]) => `${metric}: ${actual[metric]} > ${limit}`);
if (exceeded.length) throw new Error(`Build budget exceeded:\n${exceeded.join("\n")}`);

const warnings = Object.entries(limits)
  .filter(([metric, limit]) => actual[metric] >= limit * 0.85)
  .map(([metric, limit]) => `${metric}: ${actual[metric]} / ${limit}`);
if (warnings.length) console.warn(`Build budget warning (>=85%):\n${warnings.join("\n")}`);

console.info(`Build budget passed: ${actual.fontFiles} fonts, ${(actual.fontBytes / 1024).toFixed(1)} KiB fonts, ${(actual.jsBytes / 1024).toFixed(1)} KiB JS, ${(actual.cssBytes / 1024).toFixed(1)} KiB CSS.`);
