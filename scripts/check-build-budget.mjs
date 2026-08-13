import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const staticDirectory = path.resolve(
  process.env.NOVAE_NEXT_DIST_DIR || ".next",
  "static",
);

async function listFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(entryPath));
    else files.push({ name: entryPath, size: (await stat(entryPath)).size });
  }
  return files;
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
  cssBytes: 600 * 1024,
  fontBytes: 6 * 1024 * 1024,
  fontFiles: 100,
  jsBytes: 2.5 * 1024 * 1024,
};
const exceeded = Object.entries(limits).filter(([metric, limit]) => actual[metric] > limit).map(([metric, limit]) => `${metric}: ${actual[metric]} > ${limit}`);
if (exceeded.length) throw new Error(`Build budget exceeded:\n${exceeded.join("\n")}`);

console.info(`Build budget passed: ${actual.fontFiles} fonts, ${(actual.fontBytes / 1024).toFixed(1)} KiB fonts, ${(actual.jsBytes / 1024).toFixed(1)} KiB JS, ${(actual.cssBytes / 1024).toFixed(1)} KiB CSS.`);
