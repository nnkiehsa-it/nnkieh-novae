import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();
const lockDirectory = path.join(root, ".novae-generate.lock");
const ownerFile = path.join(lockDirectory, "owner.json");
const lockTimeoutMs = 15 * 60 * 1_000;
const ownerWriteGraceMs = 5_000;
const generationScripts = [
  "generate-api-errors.mjs",
  "generate-rate-limits.mjs",
  "generate-data-retention.mjs",
  "generate-backend-actions.mjs",
  "generate-harmonyos-subset.mjs",
];

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function readOwner() {
  try {
    return JSON.parse(await readFile(ownerFile, "utf8"));
  } catch {
    return null;
  }
}

async function lockIsStale() {
  const owner = await readOwner();
  if (owner) {
    return !isProcessAlive(owner.pid)
      || Date.now() - Number(owner.startedAt) > lockTimeoutMs;
  }
  try {
    return Date.now() - (await stat(lockDirectory)).mtimeMs > ownerWriteGraceMs;
  } catch {
    return false;
  }
}

async function acquireLock() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < lockTimeoutMs) {
    try {
      await mkdir(lockDirectory);
      try {
        await writeFile(ownerFile, JSON.stringify({ pid: process.pid, startedAt: Date.now() }));
      } catch (error) {
        await rm(lockDirectory, { recursive: true, force: true });
        throw error;
      }
      return;
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (await lockIsStale()) {
        await rm(lockDirectory, { recursive: true, force: true });
        continue;
      }
      await delay(250);
    }
  }
  throw new Error(`Timed out waiting for generation lock: ${lockDirectory}`);
}

function runGenerator(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(root, "scripts", script)], {
      cwd: root,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed with exit code ${code ?? 1}.`));
    });
  });
}

await acquireLock();
try {
  for (const script of generationScripts) await runGenerator(script);
} finally {
  await rm(lockDirectory, { recursive: true, force: true });
}
