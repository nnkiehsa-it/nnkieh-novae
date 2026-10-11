import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const classify = (report, directVersions) => JSON.parse(execFileSync("bun", ["--eval", `
  import { classifyAdvisories } from "./scripts/check-dependencies.mjs";
  const { report, directVersions } = JSON.parse(process.argv[1]);
  console.log(JSON.stringify(classifyAdvisories(report, directVersions)));
`, JSON.stringify({ report, directVersions })], { cwd: root, encoding: "utf8", windowsHide: true }));
const advisory = (severity, vulnerable_versions) => ({ severity, vulnerable_versions, title: "Fixture advisory", url: "https://github.com/advisories/example" });

test("a patched direct copy does not block deployment for an affected upstream copy", () => {
  const findings = classify({
    sharp: [advisory("high", "<0.35.5")],
    braces: [advisory("critical", "<=3.0.3")],
  }, { sharp: "0.35.5" });
  assert.deepEqual(findings.map(({ level }) => level), ["warning", "warning"]);
});

test("affected direct high and critical versions block; lower severity keeps the existing threshold", () => {
  const findings = classify({
    sharp: [advisory("high", "<0.35.5")],
    direct: [advisory("critical", ">=1.0.0 <2.0.0"), advisory("moderate", "*")],
  }, { sharp: "0.35.4", direct: "1.5.0" });
  assert.deepEqual(findings.map(({ level, directVersion }) => [level, directVersion]), [["error", "0.35.4"], ["error", "1.5.0"]]);
});
