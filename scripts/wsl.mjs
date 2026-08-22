import { spawnSync } from "node:child_process";
import process from "node:process";
import { createInterface } from "node:readline/promises";

function decodeWslOutput(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value ?? "");
  const utf8 = buffer.toString("utf8");
  return utf8.includes("\0") ? buffer.toString("utf16le") : utf8;
}

function listDistros(args) {
  const result = spawnSync("wsl.exe", args, { stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(decodeWslOutput(result.stderr).trim() || "Could not list WSL distributions.");
  }
  return decodeWslOutput(result.stdout)
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .map((line) => line.replaceAll("\0", "").trim())
    .filter(Boolean);
}

function runInWindowsWsl(name, args, { allowFailure = false } = {}) {
  const result = spawnSync(
    "wsl.exe",
    ["-d", name, "-u", "root", "--", ...args],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  if (result.error) throw result.error;
  if (!allowFailure && result.status !== 0) {
    throw new Error(
      decodeWslOutput(result.stderr).trim()
        || `Command failed in the ${name} WSL distribution.`,
    );
  }
  return result;
}

export function installedWindowsWslDistros() {
  if (process.platform !== "win32") return [];
  return listDistros(["--list", "--quiet"])
    .filter((name) => name.toLowerCase() !== "docker-desktop");
}

export function isWindowsWslDistroRunning(name) {
  if (process.platform !== "win32") return false;
  return listDistros(["--list", "--running", "--quiet"])
    .some((running) => running.toLowerCase() === name.toLowerCase());
}

export function terminateWindowsWslDistro(name) {
  if (process.platform !== "win32") return;
  const result = spawnSync("wsl.exe", ["--terminate", name], { stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(decodeWslOutput(result.stderr).trim() || `Could not terminate the ${name} WSL distribution.`);
  }
}

export function disableWindowsWslDockerAutostart(name) {
  if (process.platform !== "win32") return;
  runInWindowsWsl(name, [
    "systemctl",
    "disable",
    "docker.service",
    "docker.socket",
    "containerd.service",
  ]);
}

export function isWindowsWslDockerActive(name) {
  if (process.platform !== "win32") return false;
  return runInWindowsWsl(
    name,
    ["systemctl", "is-active", "--quiet", "docker.service"],
    { allowFailure: true },
  ).status === 0;
}

export function startWindowsWslDocker(name) {
  if (process.platform !== "win32") return;
  runInWindowsWsl(name, ["systemctl", "start", "docker.service"]);
}

export function stopWindowsWslDockerIfIdle(name) {
  if (process.platform !== "win32") return false;
  if (isWindowsWslDockerActive(name)) {
    const running = runInWindowsWsl(name, ["docker", "ps", "--quiet"]);
    if (decodeWslOutput(running.stdout).trim()) return false;
  }
  runInWindowsWsl(name, [
    "systemctl",
    "stop",
    "docker.service",
    "docker.socket",
    "containerd.service",
  ]);
  return true;
}

function configuredDistro(distros) {
  const requested = process.env.NOVAE_WSL_DISTRO?.trim();
  if (!requested) return null;
  const selected = distros.find((name) => name.toLowerCase() === requested.toLowerCase());
  if (!selected) {
    throw new Error(`NOVAE_WSL_DISTRO=${requested} is not installed. Available: ${distros.join(", ")}.`);
  }
  return selected;
}

export async function resolveWindowsWslDistro() {
  if (process.platform !== "win32") return null;
  const distros = installedWindowsWslDistros();
  if (distros.length === 0) throw new Error("No WSL distribution is installed.");
  const configured = configuredDistro(distros);
  if (configured) return configured;
  if (distros.length === 1) return distros[0];
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      `Multiple WSL distributions are installed (${distros.join(", ")}). Set NOVAE_WSL_DISTRO or run this command in an interactive terminal to select one.`,
    );
  }

  process.stdout.write("Select the WSL distribution for local verification:\n");
  distros.forEach((name, index) => process.stdout.write(`  ${index + 1}. ${name}\n`));
  const prompt = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await prompt.question(`Selection [1-${distros.length}]: `);
    const index = Number(answer) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= distros.length) {
      throw new Error("Invalid WSL distribution selection.");
    }
    return distros[index];
  } finally {
    prompt.close();
  }
}
