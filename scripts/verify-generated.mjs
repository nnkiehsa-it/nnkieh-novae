import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const generatedDirectories = [
  "cloudflare/generated",
  "src/assets/fonts/harmonyos-sans-tc",
  "src/generated",
];
const generatedFiles = [
  "cloudflare/src/backend/shared/api-errors.ts",
  "cloudflare/src/backend/shared/backend-action-policies.ts",
  "cloudflare/src/backend/shared/data-retention.ts",
  "cloudflare/src/backend/shared/rate-limits.ts",
  "src/services/backend-action-contract.ts",
];

async function listFiles(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listFiles(relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

async function snapshot() {
  const directoryFiles = (await Promise.all(generatedDirectories.map(listFiles))).flat();
  const files = [...new Set([...directoryFiles, ...generatedFiles])].sort();
  return new Map(await Promise.all(files.map(async (file) => [
    file.replaceAll("\\", "/"),
    createHash("sha256").update(await readFile(path.join(root, file))).digest("hex"),
  ])));
}

function runGeneration() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "scripts", "generate-all.mjs")], {
      cwd: root,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Generated-artifact refresh failed with exit code ${code ?? 1}.`));
    });
  });
}

const before = await snapshot();
await runGeneration();
const after = await snapshot();
const changed = [...new Set([...before.keys(), ...after.keys()])]
  .filter((file) => before.get(file) !== after.get(file))
  .sort();

if (changed.length > 0) {
  console.error("Generated artifacts were stale and have been refreshed:");
  for (const file of changed) console.error(`- ${file}`);
  console.error("Commit these refreshed artifacts, then run verification again.");
  process.exit(1);
}

console.info("Generated artifacts are current.");
