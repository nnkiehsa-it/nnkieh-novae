import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { semver } from "bun";

export function classifyAdvisories(report, directVersions) {
  return Object.entries(report).flatMap(([name, advisories]) =>
    advisories
      .filter(({ severity }) => severity === "high" || severity === "critical")
      .map((advisory) => {
        const version = directVersions[name];
        const direct = Boolean(version && semver.satisfies(version, advisory.vulnerable_versions));
        return { name, ...advisory, level: direct ? "error" : "warning", directVersion: direct ? version : undefined };
      }),
  );
}

function diagnostic(level, message) {
  const escaped = message.replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  console.error(process.env.GITHUB_ACTIONS === "true" ? `::${level}::${escaped}` : `${level}: ${message}`);
}

function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const audit = spawnSync(process.execPath, ["audit", "--json"], {
    cwd: root, encoding: "utf8", windowsHide: true,
  });
  if (audit.error) throw audit.error;
  if (audit.status !== 0 && audit.status !== 1) throw new Error(audit.stderr || `Bun audit exited ${audit.status}`);
  if (!audit.stdout.trim()) throw new Error(audit.stderr || "Bun audit returned no report");
  const report = JSON.parse(audit.stdout);
  const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const directNames = new Set(Object.keys({
    ...manifest.dependencies, ...manifest.devDependencies, ...manifest.optionalDependencies, ...manifest.peerDependencies,
  }));
  const directVersions = Object.fromEntries(Object.keys(report)
    .filter((name) => directNames.has(name))
    .map((name) => [name, JSON.parse(readFileSync(join(root, "node_modules", name, "package.json"), "utf8")).version]));
  const findings = classifyAdvisories(report, directVersions);
  for (const finding of findings) {
    const scope = finding.level === "error" ? `direct ${finding.directVersion}` : `indirect ${finding.vulnerable_versions}`;
    diagnostic(finding.level, `${finding.name} (${scope}) [${finding.severity}]: ${finding.title} ${finding.url}`);
  }
  const errors = findings.filter(({ level }) => level === "error").length;
  console.log(`Dependency audit: ${errors} errors; ${findings.length - errors} indirect warnings.`);
  process.exitCode = errors ? 1 : 0;
}

if (import.meta.main) main();
