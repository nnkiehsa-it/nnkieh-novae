import { readFile } from "node:fs/promises";

const [zh, en] = await Promise.all([
  readFile(new URL("../content/zh.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../content/en.json", import.meta.url), "utf8").then(JSON.parse),
]);
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

const zhKeys = Object.keys(zh).sort();
const enKeys = Object.keys(en).sort();
if (JSON.stringify(zhKeys) !== JSON.stringify(enKeys)) {
  throw new Error("Website language catalogs must have the same keys.");
}
for (const key of zhKeys) {
  if (!String(zh[key]).trim() || !String(en[key]).trim()) {
    throw new Error(`Website message is empty: ${key}`);
  }
}
for (const match of html.matchAll(/\bdata-i18n(?:-alt|-aria)?="([^"]+)"/g)) {
  if (!(match[1] in zh)) throw new Error(`Website markup references a missing message: ${match[1]}`);
}
console.log(`Website content check passed: ${zhKeys.length} bilingual messages.`);
