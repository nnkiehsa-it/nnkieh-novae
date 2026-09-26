import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dist = fileURLToPath(new URL("../dist/", import.meta.url)).replace(/[\\/]$/, "");
const html = await readFile(path.join(dist, "index.html"), "utf8");
const base = process.env.GITHUB_PAGES_BASE || "/";
const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]));
const references = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((match) => match[1]);

for (const reference of references) {
  if (/^(?:https?:|mailto:|data:)/.test(reference)) continue;
  if (reference.startsWith("#")) {
    if (!ids.has(reference.slice(1))) throw new Error(`Missing anchor: ${reference}`);
    continue;
  }
  const url = new URL(reference, `https://example.invalid${base}`);
  if (!url.pathname.startsWith(base)) throw new Error(`Asset escapes Pages base: ${reference}`);
  const relative = decodeURIComponent(url.pathname.slice(base.length));
  const target = path.resolve(dist, relative);
  if (!target.startsWith(`${dist}${path.sep}`)) throw new Error(`Asset escapes dist: ${reference}`);
  await access(target).catch(() => { throw new Error(`Missing built asset: ${reference}`); });
}

console.log(`Website link check passed: ${references.length} references.`);
