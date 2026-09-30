import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync, openSync, closeSync, renameSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { setInterval, clearInterval } from "node:timers";
import { resolveWindowsWslDistro } from "./wsl.mjs";

const script = fileURLToPath(import.meta.url);
const root = dirname(dirname(script));
const directory = join(root, ".novae-phone-preview");
const statePath = join(directory, "state.json");
const stopPath = join(directory, "stop");
const logPath = join(directory, "preview.log");
const command = process.argv[2] ?? "start";
const port = Number(process.argv[3] ?? 3002);
const proxies = [{ port: 443, target: `http://127.0.0.1:${port}` }, { port: 8443, target: "http://127.0.0.1:8787" }, { port: 9443, target: "http://127.0.0.1:9099" }];

function readState() { return existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : null; }
function running(state) {
  if (!state?.pid) return false;
  try { process.kill(state.pid, 0); return true; } catch { return false; }
}
function save(state) {
  const temporary = `${statePath}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(temporary, statePath);
}
function run(program, args, env = process.env) {
  const result = spawnSync(program, args, { cwd: root, env, encoding: "utf8", windowsHide: true, timeout: 30000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${program} failed.`);
  return result.stdout.trim();
}
function serveConfig() { return JSON.parse(run("tailscale", ["serve", "status", "--json"])); }
function matches(config, hostname, proxy) {
  const key = `${hostname}:${proxy.port}`;
  const handlers = config.Web?.[key]?.Handlers;
  return config.TCP?.[proxy.port]?.HTTPS === true && handlers
    && Object.keys(handlers).length === 1 && handlers["/"]?.Proxy === proxy.target
    && !config.AllowFunnel?.[key];
}
function device() {
  const status = JSON.parse(run("tailscale", ["status", "--json"]));
  if (status.BackendState !== "Running") throw new Error("Tailscale 尚未 connected；先恢復連線。若 WARP 正在使用，先確認兩者是否衝突。");
  const hostname = status.Self.DNSName.replace(/\.$/u, "");
  if (!/^[a-z0-9-]+\.tail[a-z0-9]+\.ts\.net$/u.test(hostname)) throw new Error("此裝置尚未具備 Tailscale HTTPS 裝置網址。");
  return hostname;
}
function checkPorts(config, hostname) {
  for (const proxy of proxies) {
    if (config.TCP?.[proxy.port] && !matches(config, hostname, proxy)) {
      throw new Error(`Tailscale ${proxy.port} 已有其他設定，沒有覆寫。請先選擇要保留的服務。`);
    }
  }
}
function removeProxies(state) {
  const config = serveConfig();
  for (const proxy of state.proxies) {
    if (matches(config, state.hostname, proxy)) run("tailscale", ["serve", `--https=${proxy.port}`, "off"]);
  }
}
function verify(state) {
  if (state?.phase !== "ready" || !running(state)) throw new Error("預覽尚未 ready；請查詢 status 和日誌。");
  const output = run(process.execPath, ["scripts/check-local-auth-emulator.mjs"], {
    ...process.env,
    NOVAE_AUTH_EMULATOR_URL: `${state.origin}:9443`,
    NOVAE_LOCAL_GATEWAY_URL: `${state.origin}:8443`,
    NOVAE_LOCAL_APP_ORIGIN: state.origin,
  });
  console.log(output);
}

async function supervise() {
  let state = readState();
  state = { ...state, pid: process.pid, phase: "starting" };
  save(state);
  let child;
  let completion;
  let stopTimer;
  let tail = "";
  try {
    checkPorts(serveConfig(), state.hostname);
    for (const proxy of state.proxies) run("tailscale", ["serve", "--bg", `--https=${proxy.port}`, proxy.target]);
    child = spawn(process.execPath, ["scripts/verify-integration.mjs", "--serve", "--preview"], {
      cwd: root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NOVAE_SERVE_SESSION: "1", NOVAE_TEST_APP_PORT: String(state.port), NOVAE_TEST_PUBLIC_ORIGIN: state.origin, NOVAE_WSL_DISTRO: (await resolveWindowsWslDistro()) ?? "" },
    });
    completion = new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
    child.stderr.on("data", (data) => process.stderr.write(data));
    child.stdout.on("data", (data) => process.stdout.write(data));
    const ready = new Promise((resolve, reject) => {
      const observe = (data) => {
        tail = `${tail}${data}`.slice(-4096);
        if (tail.includes("[environment] Ready")) resolve();
      };
      child.stdout.on("data", observe);
      child.stderr.on("data", observe);
      completion.then(() => reject(new Error("測試環境在 ready 前停止，請讀 preview.log。")), reject);
    });
    stopTimer = setInterval(() => {
      if (existsSync(stopPath)) {
        state.phase = "stopping";
        save(state);
        child.stdin.end();
        clearInterval(stopTimer);
      }
    }, 500);
    await ready;
    if (!existsSync(stopPath)) {
      verify({ ...state, phase: "ready" });
      state.phase = "ready";
      save(state);
      console.log(`手機網址：${state.origin}/home`);
    }
    const code = await completion;
    if (code !== 0) throw new Error(`測試環境結束：${code}`);
    state.phase = "stopped";
  } catch (error) {
    state.phase = "error";
    state.error = error.message;
    console.error(error.message);
    if (child?.exitCode === null) {
      child.stdin.end();
      await completion;
    }
  } finally {
    clearInterval(stopTimer);
    try { removeProxies(state); } catch (error) { state.phase = "error"; state.error = error.message; }
    save({ ...state, pid: null });
  }
}

try {
  if (!["start", "stop", "status", "verify", "run"].includes(command)) throw new Error("用法：node scripts/tailscale-preview.mjs start [3002] | status | verify | stop");
  if (command === "run") {
    await supervise();
  } else if (command === "start") {
    const existing = readState();
    if (running(existing)) {
      console.log(JSON.stringify(existing, null, 2));
    } else {
      if (!Number.isInteger(port) || port < 1024 || port > 65535 || [8787, 9099].includes(port)) throw new Error("前端連接埠無效。");
      const hostname = device();
      checkPorts(serveConfig(), hostname);
      mkdirSync(directory, { recursive: true });
      if (existsSync(stopPath)) unlinkSync(stopPath);
      const log = openSync(logPath, "w");
      const child = spawn(process.execPath, [script, "run", String(port)], { cwd: root, detached: true, windowsHide: true, stdio: ["ignore", log, log] });
      save({ pid: child.pid, phase: "starting", hostname, origin: `https://${hostname}`, port, proxies, logPath });
      closeSync(log);
      child.unref();
      console.log(`正在建置並啟動：https://${hostname}/home\n日誌：${logPath}\n用 status 確認 ready，再執行 verify。`);
    }
  } else if (command === "status") {
    const state = readState();
    console.log(JSON.stringify(state ? { ...state, running: running(state) } : { phase: "stopped", running: false }, null, 2));
  } else if (command === "verify") {
    const state = readState();
    verify(state);
    const response = await fetch(`${state.origin}/home`, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`首頁回應 ${response.status}`);
    console.log(`HTTP 首頁／登入／API 通過：${state.origin}/home；瀏覽器操作仍需另行驗證。`);
  } else {
    const state = readState();
    if (running(state)) {
      writeFileSync(stopPath, "stop\n");
      const deadline = Date.now() + 90000;
      while (running(readState()) && Date.now() < deadline) await delay(500);
      if (running(readState())) throw new Error(`停止尚未完成；請查看 ${logPath}。`);
    } else if (state) {
      removeProxies(state);
      save({ ...state, pid: null, phase: "stopped" });
    }
    console.log("預覽已停止；只移除本腳本仍匹配的三個 Serve 代理。");
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
