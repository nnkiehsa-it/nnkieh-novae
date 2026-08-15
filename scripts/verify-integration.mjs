import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, readFileSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";

const root = process.cwd();
const e2e = process.argv.includes("--e2e");
const serve = process.argv.includes("--serve");
const keepRunning = process.argv.includes("--keep-running") || serve;
const stressIndex = process.argv.indexOf("--stress-scale");
const stressScale = stressIndex >= 0 ? process.argv[stressIndex + 1] : "4";
if (!/^\d+$/u.test(stressScale) || Number(stressScale) < 2 || Number(stressScale) > 20) {
  throw new Error("--stress-scale must be an integer between 2 and 20.");
}

const runtimeDatabaseUrl =
  "postgresql://novae_runtime:novae-runtime-local@127.0.0.1:55432/novae";
const ownerDatabaseUrl =
  "postgresql://novae:novae-local@127.0.0.1:55432/novae";
const workerUrl = "http://127.0.0.1:8787";
const appUrl = "http://127.0.0.1:3000";
const npmCli = process.env.npm_execpath;
const npxCli = npmCli ? join(dirname(npmCli), "npx-cli.js") : "";
const vitestCli = join(root, "node_modules", "vitest", "vitest.mjs");
const wranglerCli = join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const tempDirectory = await mkdtemp(join(tmpdir(), "novae-integration-"));
const children = [];
const ownedPorts = new Set();

function run(label, command, args, environment = {}) {
  process.stderr.write(`[integration] ${label}\n`);
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...environment },
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${label} failed with exit code ${result.status ?? 1}.`);
  }
}

function start(label, command, args, environment = {}, ports = []) {
  const logPath = join(tempDirectory, `${label.replace(/[^a-z0-9]+/giu, "-")}.log`);
  const log = createWriteStream(logPath, { flags: "a" });
  const child = spawn(command, args, {
    cwd: root,
    detached: process.platform !== "win32",
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  children.push({ child, label, log, logPath });
  for (const port of ports) ownedPorts.add(port);
  return child;
}

function windowsListenerPids(ports) {
  if (process.platform !== "win32") return [];
  const result = spawnSync("netstat.exe", ["-ano", "-p", "tcp"], { encoding: "utf8" });
  if (result.error) throw result.error;
  const pids = new Set();
  for (const line of result.stdout.split(/\r?\n/u)) {
    const fields = line.trim().split(/\s+/u);
    if (fields[0] !== "TCP" || fields.length < 5) continue;
    const portMatch = fields[1].match(/:(\d+)$/u);
    const pid = Number(fields.at(-1));
    if (portMatch && ports.has(Number(portMatch[1])) && Number.isSafeInteger(pid) && pid > 0) {
      pids.add(pid);
    }
  }
  return [...pids];
}

async function stopChild(entry) {
  if (entry.child.exitCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(entry.child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    try {
      process.kill(-entry.child.pid, "SIGTERM");
    } catch {
      entry.child.kill("SIGTERM");
    }
  }
}

async function cleanup() {
  for (const entry of [...children].reverse()) await stopChild(entry);
  if (process.platform === "win32") {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const listenerPids = windowsListenerPids(ownedPorts);
      if (listenerPids.length === 0) break;
      for (const pid of listenerPids) {
        spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore" });
      }
      await delay(100);
    }
  }
  for (const entry of children) entry.log.end();
}

async function waitFor(label, url, expected, child, logPath, init = {}) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (child.exitCode !== null) {
      throw new Error(`${label} exited early.\n${readFileSync(logPath, "utf8").slice(-8000)}`);
    }
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(2_000) });
      if (expected(response)) return;
    } catch {
      // Service is still starting.
    }
    await delay(500);
  }
  throw new Error(`${label} did not become ready.\n${readFileSync(logPath, "utf8").slice(-8000)}`);
}

process.once("SIGINT", async () => {
  await cleanup();
  process.exit(130);
});
process.once("SIGTERM", async () => {
  await cleanup();
  process.exit(143);
});

const requiredServicePorts = new Set([3000, 4000, 4400, 4500, 8787, 9099, 54330]);
const occupiedServicePids = windowsListenerPids(requiredServicePorts);
if (occupiedServicePids.length > 0) {
  throw new Error(
    `Integration service ports are already occupied by process IDs: ${occupiedServicePids.join(", ")}.`,
  );
}

try {
  run("reset PostgreSQL and apply migrations", process.execPath, [
    "scripts/database.mjs",
    "reset-local",
    serve || e2e ? "--seed" : "--seed-integration",
  ]);
  run(
    "configure least-privilege Worker role",
    process.execPath,
    ["scripts/configure-database-runtime.mjs"],
    {
      DATABASE_RUNTIME_PASSWORD: "novae-runtime-local",
      DATABASE_URL: ownerDatabaseUrl,
    },
  );

  const provider = start(
    "external-provider",
    process.execPath,
    ["scripts/external-provider-test-server.mjs"],
    {},
    [54330],
  );
  const providerEntry = children.at(-1);
  await waitFor(
    "external provider",
    "http://127.0.0.1:54330/__requests",
    (response) => response.status === 200,
    provider,
    providerEntry.logPath,
  );

  let firebase;
  if (serve || e2e) {
    if (!npxCli) throw new Error("Run the integration environment through npm so Firebase tools can be resolved.");
    firebase = start(
      "firebase-auth",
      process.execPath,
      [npxCli, "--yes", "firebase-tools@15.24.0", "emulators:start", "--only", "auth", "--project", "integration-project"],
      {},
      [4000, 4400, 4500, 9099],
    );
    const firebaseEntry = children.at(-1);
    await waitFor(
      "Firebase Auth emulator",
      "http://127.0.0.1:9099/",
      () => true,
      firebase,
      firebaseEntry.logPath,
    );
  }

  const workerVariables = {
    ALLOWED_DOMAIN: "integration.invalid",
    ALLOWED_ORIGINS: `${appUrl},http://localhost:3000`,
    ADMIN_EMAILS: "admin@integration.invalid",
    CLOUDINARY_API_BASE_URL: "http://127.0.0.1:54330",
    CLOUDINARY_API_KEY: "integration-api-key",
    CLOUDINARY_API_SECRET: "integration-api-secret",
    CLOUDINARY_CLOUD_NAME: "integration-cloud",
    CLOUDINARY_DELIVERY_BASE_URL: "http://127.0.0.1:54330",
    FCM_EMULATOR_URL: "http://127.0.0.1:54330",
    FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
    FIREBASE_PROJECT_ID: "integration-project",
    FIREBASE_WEB_API_KEY: "integration-web-api-key",
    GOOGLE_SERVICE_ACCOUNT_JSON: "not-used-with-emulator",
    HEALTHCHECK_SECRET: "integration-healthcheck-secret",
    LOCAL_TEST_MODE: "true",
    MEDIA_SIGNING_SECRET: "integration-media-signing-secret-that-is-long-enough",
    PUBLIC_API_URL: workerUrl,
    REALTIME_TICKET_SECRET: "integration-realtime-ticket-secret-that-is-long-enough",
  };
  const workerArgs = [
    "dev",
    "--config",
    "cloudflare/wrangler.json",
    "--local",
    "--port",
    "8787",
  ];
  for (const [name, value] of Object.entries(workerVariables)) {
    workerArgs.push("--var", `${name}:${value}`);
  }
  const worker = start("cloudflare-worker", process.execPath, [wranglerCli, ...workerArgs], {}, [8787]);
  const workerEntry = children.at(-1);
  await waitFor(
    "Cloudflare Worker",
    `${workerUrl}/v1/actions`,
    (response) => response.status === 204,
    worker,
    workerEntry.logPath,
    { headers: { origin: appUrl }, method: "OPTIONS" },
  );

  const integrationEnvironment = {
    CLOUDINARY_API_BASE_URL: "http://127.0.0.1:54330",
    CLOUDINARY_DELIVERY_BASE_URL: "http://127.0.0.1:54330",
    DATABASE_URL: runtimeDatabaseUrl,
    DATABASE_OWNER_URL: ownerDatabaseUrl,
    FCM_EMULATOR_URL: "http://127.0.0.1:54330",
    FIREBASE_PROJECT_ID: "integration-project",
    NOVAE_STRESS_SCALE: stressScale,
    WORKER_URL: workerUrl,
  };

  if (!serve && !e2e) {
    run(
      "backend actions, permissions, jobs, realtime persistence, and Worker boundaries",
      process.execPath,
      [vitestCli, "run", "--config", "vitest.integration.config.ts"],
      integrationEnvironment,
    );
    process.stderr.write("✓ Local integration verification passed\n");
  } else {
    const frontendEnvironment = {
      ...integrationEnvironment,
      NEXT_PUBLIC_ALLOWED_DOMAIN: "integration.invalid",
      NEXT_PUBLIC_API_BASE_URL: workerUrl,
      NEXT_PUBLIC_FIREBASE_API_KEY: "integration-web-api-key",
      NEXT_PUBLIC_FIREBASE_APP_CHECK_ENABLED: "false",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:local",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "integration-project.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "integration-project",
      NEXT_PUBLIC_LOCAL_DEV_AUTH: e2e ? "false" : "true",
      NEXT_PUBLIC_LOCAL_DEV_AUTH_EMAIL: "admin@integration.invalid",
      NOVAE_AUTH_EMULATOR_URL: "http://127.0.0.1:9099",
      NOVAE_E2E_BASE_URL: appUrl,
      NOVAE_LOCAL_GATEWAY_URL: workerUrl,
    };
    if (e2e) {
      if (!npmCli) throw new Error("Run E2E verification through npm.");
      run("build production frontend", process.execPath, [npmCli, "run", "build:deploy"], frontendEnvironment);
    }
    const frontend = start(
      "next",
      process.execPath,
      e2e ? [npmCli, "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"] : [npmCli, "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"],
      frontendEnvironment,
      [3000],
    );
    const frontendEntry = children.at(-1);
    await waitFor(
      "Next.js",
      `${appUrl}/login`,
      (response) => response.status === 200,
      frontend,
      frontendEntry.logPath,
    );
    run("Firebase login and API routing probe", process.execPath, ["scripts/check-local-auth-emulator.mjs"], frontendEnvironment);
    if (e2e) {
      run("Playwright browser journeys", process.execPath, [npmCli, "run", "--silent", "test:e2e:runner"], frontendEnvironment);
      process.stderr.write("✓ End-to-end verification passed\n");
    } else {
      process.stderr.write(`\n[environment] Ready\n  App: ${appUrl}\n  API: ${workerUrl}\n  Auth emulator: http://127.0.0.1:4000/auth\n  Stop: Ctrl+C\n`);
      await new Promise((resolve) => frontend.once("exit", resolve));
    }
  }
} finally {
  if (!keepRunning || e2e) await cleanup();
}
