import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const assetsDirectory = path.resolve('dist', 'assets');
const entries = await readdir(assetsDirectory);
const assets = await Promise.all(entries.map(async (name) => ({
  name,
  size: (await stat(path.join(assetsDirectory, name))).size,
})));

const sum = (extension) => assets
  .filter((asset) => asset.name.endsWith(extension))
  .reduce((total, asset) => total + asset.size, 0);
const fonts = assets.filter((asset) => asset.name.endsWith('.woff2'));
const limits = {
  cssBytes: 550 * 1024,
  fontBytes: 9.2 * 1024 * 1024,
  fontFiles: 160,
  // Reka's accessible behavior layer and the lazy Motion interaction layer
  // are intentional product infrastructure, not page-local payload.
  jsBytes: 1.45 * 1024 * 1024,
};
const actual = {
  cssBytes: sum('.css'),
  fontBytes: sum('.woff2'),
  fontFiles: fonts.length,
  jsBytes: sum('.js'),
};
const exceeded = Object.entries(limits)
  .filter(([metric, limit]) => actual[metric] > limit)
  .map(([metric, limit]) => `${metric}: ${actual[metric]} > ${limit}`);

if (exceeded.length > 0) {
  throw new Error(`Build budget exceeded:\n${exceeded.join('\n')}`);
}

console.info(
  `Build budget passed: ${actual.fontFiles} fonts, `
  + `${(actual.fontBytes / 1024 / 1024).toFixed(2)} MiB fonts, `
  + `${(actual.jsBytes / 1024).toFixed(1)} KiB JS, `
  + `${(actual.cssBytes / 1024).toFixed(1)} KiB CSS.`,
);
