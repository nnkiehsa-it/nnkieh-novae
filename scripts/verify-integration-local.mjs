import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

function normalizeMultilineJsonValue(path, key) {
  const source = readFileSync(path, "utf8");
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const lines = source.split(/\r?\n/u);
  const start = lines.findIndex((line) => line.startsWith(`${key}=`));
  if (start < 0) return;

  const firstValue = lines[start].slice(key.length + 1);
  try {
    JSON.parse(firstValue);
    return;
  } catch {
    // Continue until the multiline JSON value becomes complete.
  }

  let candidate = firstValue;
  for (let end = start + 1; end < lines.length; end += 1) {
    if (/^[A-Za-z_][A-Za-z0-9_]*=/u.test(lines[end])) break;
    candidate += `\n${lines[end]}`;
    try {
      const parsed = JSON.parse(candidate);
      lines.splice(start, end - start + 1, `${key}=${JSON.stringify(parsed)}`);
      writeFileSync(path, lines.join(newline), "utf8");
      return;
    } catch {
      // Keep collecting the current JSON object.
    }
  }
  throw new Error(`${key} in ${path} is not valid JSON.`);
}

const defaultEnvFile = fileURLToPath(new URL("../.env.local", import.meta.url));
const envFile =
  readOption("--env-file") ?? process.env.NOVAE_TEST_ENV_FILE ?? defaultEnvFile;
const hasEnvFile = existsSync(envFile);
if (hasEnvFile) {
  normalizeMultilineJsonValue(envFile, "GOOGLE_SERVICE_ACCOUNT_JSON");
} else if (readOption("--env-file") || process.env.NOVAE_TEST_ENV_FILE) {
  console.error(`Integration env file does not exist: ${envFile}`);
  process.exit(2);
} else {
  console.log(
    "[integration] .env.local not found; using isolated local test defaults",
  );
}

const scriptPath = fileURLToPath(
  new URL("./verify-integration-local.sh", import.meta.url),
);
const keepRunning = process.argv.includes("--keep-running");
const serve = process.argv.includes("--serve");
const e2e = process.argv.includes("--e2e");
const stressScale = readOption("--stress-scale");
if (process.platform === "win32") {
  const distro = process.env.NOVAE_WSL_DISTRO ?? "Debian";
  const convertPath = (path) => {
    const match = /^([a-z]):[\\/](.*)$/iu.exec(path);
    if (!match) throw new Error(`Unsupported Windows path for WSL: ${path}`);
    return `/mnt/${match[1].toLowerCase()}/${match[2].replaceAll("\\", "/")}`;
  };
  run("wsl.exe", [
    "-d",
    distro,
    "--",
    "bash",
    convertPath(scriptPath),
    ...(hasEnvFile ? ["--env-file", convertPath(envFile)] : []),
    ...(keepRunning ? ["--keep-running"] : []),
    ...(serve || e2e ? ["--serve"] : []),
    ...(e2e ? ["--e2e"] : []),
    ...(stressScale ? ["--stress-scale", stressScale] : []),
  ]);
} else {
  run("bash", [
    scriptPath,
    ...(hasEnvFile ? ["--env-file", envFile] : []),
    ...(keepRunning ? ["--keep-running"] : []),
    ...(serve || e2e ? ["--serve"] : []),
    ...(e2e ? ["--e2e"] : []),
    ...(stressScale ? ["--stress-scale", stressScale] : []),
  ]);
}
