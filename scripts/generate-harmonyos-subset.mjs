import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");
const fontRoot = path.join(
  projectRoot,
  "node_modules/harmonyos-sans-webfont-splitted/dist/HarmonyOS_Sans_TC",
);
const outputRoot = path.join(sourceRoot, "assets/fonts/harmonyos-sans-tc");
const sourceExtensions = new Set([".css", ".ts", ".tsx"]);
const cjkCharacter = /[\u3000-\u303f\u3100-\u312f\u31a0-\u31bf\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef]/u;

async function listSourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "generated" || entry.name === "assets") continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listSourceFiles(entryPath));
    else if (sourceExtensions.has(path.extname(entry.name))) files.push(entryPath);
  }
  return files;
}

function rangeIncludesCharacter(rangeList, characters) {
  const ranges = rangeList.split(",").flatMap((range) => {
    const match = range.trim().match(/^U\+([\da-f]+)(?:-([\da-f]+))?$/iu);
    if (!match) return [];
    return [[Number.parseInt(match[1], 16), Number.parseInt(match[2] ?? match[1], 16)]];
  });
  return characters.some((character) => {
    const codePoint = character.codePointAt(0);
    return ranges.some(([start, end]) => codePoint >= start && codePoint <= end);
  });
}

const sourceText = (
  await Promise.all((await listSourceFiles(sourceRoot)).map((file) => readFile(file, "utf8")))
).join("\n");
const characters = [...new Set([...sourceText].filter((character) => cjkCharacter.test(character)))];
const regularCss = await readFile(path.join(fontRoot, "Regular.css"), "utf8");
const selectedFaces = [...regularCss.matchAll(/@font-face\s*\{[^}]+\}/gu)]
  .map((match) => match[0])
  .filter((face) => {
    const range = face.match(/unicode-range:([^;}]+)/u)?.[1];
    return range ? rangeIncludesCharacter(range, characters) : false;
  });

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });

const outputFaces = [];
for (const face of selectedFaces) {
  const relativeFontPath = face.match(/url\("([^"]+)"\)/u)?.[1];
  if (!relativeFontPath) continue;
  const fileName = path.basename(relativeFontPath);
  await cp(path.resolve(fontRoot, relativeFontPath), path.join(outputRoot, fileName));
  outputFaces.push(face.replace(relativeFontPath, `./${fileName}`));
}

await writeFile(
  path.join(outputRoot, "harmonyos-sans-tc.css"),
  `${outputFaces.join("\n")}\n`,
  "utf8",
);
console.info(
  `Generated HarmonyOS Sans TC subset: ${characters.length} characters across ${outputFaces.length} font shards.`,
);
