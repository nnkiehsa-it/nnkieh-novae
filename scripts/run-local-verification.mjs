import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
import process from "node:process";
import { clearInterval, setInterval } from "node:timers";
import { URL } from "node:url";

const runAll = process.argv.includes("--all");
const suite = process.argv.includes("--unit-only")
  ? "unit"
  : process.argv.includes("--architecture-only")
    ? "architecture"
    : process.argv.includes("--tooling-only")
      ? "tooling"
      : process.argv.includes("--test-only")
        ? "test"
        : process.argv.includes("--fast")
          ? "fast"
          : "local";
const verbose = process.env.NOVAE_VERBOSE_TESTS === "1";
const isInteractive = Boolean(process.stderr.isTTY);
const maxCapturedCharacters = 4_000_000;
const verificationBuildEnvironment = {
  NOVAE_NEXT_DIST_DIR: ".next-verify",
};

function executable(name) {
  const suffix = process.platform === "win32" ? ".cmd" : "";
  const localPath = new URL(
    `../node_modules/.bin/${name}${suffix}`,
    import.meta.url,
  );
  try {
    accessSync(localPath, constants.X_OK);
    return decodeURIComponent(
      localPath.pathname.replace(/^\/([A-Za-z]:)/u, "$1"),
    );
  } catch {
    return name;
  }
}

const node = process.execPath;
const bun = process.platform === "win32" ? "bun.exe" : "bun";
const steps = {
  checks: [
    ["generated artifacts", node, ["scripts/verify-generated.mjs"]],
    ["TypeScript", executable("tsc"), ["--noEmit"]],
    [
      "unused declarations",
      executable("tsc"),
      ["--noEmit", "--noUnusedLocals", "--noUnusedParameters"],
    ],
    ["translations", node, ["scripts/check-i18n.mjs"]],
    ["UI architecture", node, ["scripts/check-ui-primitives.mjs"]],
    ["ESLint", executable("eslint"), ["."]],
    ["production bundle", executable("next"), ["build", "--webpack"], verificationBuildEnvironment],
    ["build budget", node, ["scripts/check-build-budget.mjs"], verificationBuildEnvironment],
    [
      "Cloudflare Worker types",
      executable("tsc"),
      ["-p", "cloudflare/tsconfig.json", "--noEmit"],
    ],
    [
      "integration test types",
      executable("tsc"),
      ["-p", "tsconfig.integration.json", "--noEmit"],
    ],
  ],
  tests: [
    ["unit tests", executable("vitest"), ["run"]],
    ["architecture tests", node, ["--test", "tests/architecture.test.mjs"]],
    ["tooling policy tests", node, ["--test", "tests/tooling.test.mjs"]],
  ],
  audit: [["dependency audit", bun, ["audit", "--audit-level=high"]]],
};

steps.fast = [
  ...steps.checks.slice(0, 6),
  steps.checks[8],
  steps.checks[9],
  ...steps.tests,
];

const selectedSteps =
  suite === "unit"
    ? [steps.tests[0]]
    : suite === "architecture"
      ? [steps.tests[1]]
      : suite === "tooling"
        ? [steps.tests[2]]
        : suite === "test"
          ? steps.tests
          : suite === "fast"
            ? steps.fast
            : [...steps.checks, ...steps.tests, ...steps.audit];

let completed = 0;
let progressTimer;

if (runAll) process.stderr.write("[1/3] Local verification\n");

function formatProgress(label) {
  const width = 20;
  const filled = Math.floor((completed / selectedSteps.length) * width);
  const bar = `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
  return `[${bar}] ${completed}/${selectedSteps.length} ${label}`;
}

function clearProgress() {
  if (!isInteractive) return;
  clearInterval(progressTimer);
  process.stderr.write("\r\x1b[2K");
}

function startProgress(label) {
  if (!isInteractive) {
    process.stderr.write(
      `[${completed + 1}/${selectedSteps.length}] ${label}\n`,
    );
    return;
  }
  const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
  let frame = 0;
  const render = () => {
    process.stderr.write(
      `\r\x1b[2K${formatProgress(`${frames[frame++ % frames.length]} ${label}`)}`,
    );
  };
  render();
  progressTimer = setInterval(render, 120);
  progressTimer.unref();
}

function appendBounded(current, chunk) {
  const combined = current + chunk;
  return combined.length <= maxCapturedCharacters
    ? combined
    : combined.slice(combined.length - maxCapturedCharacters);
}

function warningLines(output) {
  const lines = output.split(/\r?\n/u);
  const warningPattern =
    /\b(?:warning|warn|error|deprecated|ignored build scripts)\b/iu;
  return [...new Set(lines.filter(
    (line) => warningPattern.test(line) && !/^Generated\b/u.test(line),
  ))].slice(
    0,
    40,
  );
}

function diagnosticTail(output) {
  return output.trimEnd().split(/\r?\n/u).slice(-160).join("\n");
}

function spawnInvocation(command, args) {
  if (process.platform !== "win32" || !command.toLowerCase().endsWith(".cmd")) {
    return { command, args, shell: false };
  }
  const quote = (value) => `"${value.replaceAll('"', '""')}"`;
  return {
    command: [command, ...args].map(quote).join(" "),
    args: [],
    shell: true,
  };
}

async function runStep([label, command, args, environment = {}]) {
  startProgress(label);
  let output = "";
  const invocation = spawnInvocation(command, args);
  const status = await new Promise((resolve, reject) => {
    const options = {
      cwd: process.cwd(),
      env: {
        ...process.env,
        ...environment,
        NO_COLOR: "1",
      },
      stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"],
      shell: invocation.shell,
    };
    const child = invocation.shell
      ? spawn(invocation.command, options)
      : spawn(invocation.command, invocation.args, options);
    if (!verbose) {
      child.stdout.on("data", (chunk) => {
        output = appendBounded(output, chunk.toString());
      });
      child.stderr.on("data", (chunk) => {
        output = appendBounded(output, chunk.toString());
      });
    }
    child.once("error", reject);
    child.once("close", resolve);
  });
  clearProgress();

  if (status !== 0) {
    process.stderr.write(`✗ ${label} failed (exit ${status})\n`);
    if (!verbose && output.trim())
      process.stderr.write(`${diagnosticTail(output)}\n`);
    process.exit(status ?? 1);
  }

  completed += 1;
  if (isInteractive) process.stderr.write(`${formatProgress(`✓ ${label}`)}\n`);
  if (!verbose) {
    const warnings = warningLines(output);
    if (warnings.length > 0) {
      process.stderr.write(`Warnings from ${label}:\n${warnings.join("\n")}\n`);
    }
  }
}

for (const step of selectedSteps) {
  await runStep(step);
}

const suiteLabel = {
  local: "Local verification",
  fast: "Fast verification",
  test: "Local tests",
  unit: "Unit tests",
  architecture: "Architecture tests",
  tooling: "Tooling policy tests",
}[suite];
process.stderr.write(
  `✓ ${suiteLabel} passed (${selectedSteps.length} stages)\n`,
);

async function runSuite(label, args) {
  process.stderr.write(`\n${label}\n`);
  const status = await new Promise((resolve, reject) => {
    const child = spawn(node, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("close", resolve);
  });
  if (status !== 0) process.exit(status ?? 1);
}

if (runAll) {
  await runSuite("[2/3] Integration verification", [
    "scripts/verify-integration.mjs",
  ]);
  await runSuite("[3/3] End-to-end verification", [
    "scripts/verify-integration.mjs",
    "--e2e",
  ]);
  process.stderr.write("\n✓ All verification suites passed\n");
}
