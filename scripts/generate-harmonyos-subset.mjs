import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
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
const weights = [
  { file: "Regular.css", name: "Regular", weight: 400 },
  { file: "Medium.css", name: "Medium", weight: 500 },
  { file: "Semibold.css", name: "Semibold", weight: 600 },
  { file: "Bold.css", name: "Bold", weight: 700 },
];
const selectedFaces = (
  await Promise.all(weights.map(async ({ file, name, weight }) => {
    const css = await readFile(path.join(fontRoot, file), "utf8");
    return [...css.matchAll(/@font-face\s*\{[^}]+\}/gu)]
      .map((match) => match[0])
      .filter((face) => {
        const range = face.match(/unicode-range:([^;}]+)/u)?.[1];
        return range ? rangeIncludesCharacter(range, characters) : false;
      })
      .map((face) => ({ face, name, weight }));
  }))
).flat();

await mkdir(outputRoot, { recursive: true });

// A live preview imports this CSS. Keep existing assets available throughout
// generation, and do not trigger HMR for byte-identical generated artifacts.
async function writeChanged(file, content) {
  const bytes = Buffer.from(content);
  const previous = await readFile(file).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (previous?.equals(bytes)) return;
  await writeFile(`${file}.tmp`, bytes);
  await rename(`${file}.tmp`, file);
}

const outputFaces = [];
const outputNames = new Set(["harmonyos-sans-tc.css"]);
for (const { face, name, weight } of selectedFaces) {
  const relativeFontPath = face.match(/url\("([^"]+)"\)/u)?.[1];
  if (!relativeFontPath) continue;
  const fileName = path.basename(relativeFontPath).replace(/^[^_]+/u, name);
  outputNames.add(fileName);
  await writeChanged(path.join(outputRoot, fileName), await readFile(path.resolve(fontRoot, relativeFontPath)));
  outputFaces.push(
    face
      .replace(relativeFontPath, `./${fileName}`)
      .replace(/font-weight:\s*\d+/u, `font-weight: ${weight}`),
  );
}

await writeChanged(
  path.join(outputRoot, "harmonyos-sans-tc.css"),
  `${outputFaces.join("\n")}\n`,
);
for (const name of await readdir(outputRoot)) {
  if (!outputNames.has(name)) await rm(path.join(outputRoot, name));
}
console.info(
  `Generated HarmonyOS Sans TC subset: ${characters.length} characters across ${outputFaces.length} font shards.`,
);
