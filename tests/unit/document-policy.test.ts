import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  DOCUMENT_BOOT_SCRIPT,
  isIsolatedLocalBuild,
} from "@/app/document-policy";

const root = join(import.meta.dirname, "../..");
const hash = createHash("sha256").update(DOCUMENT_BOOT_SCRIPT).digest("base64");
const vercel = JSON.parse(readFileSync(join(root, "vercel.json"), "utf8")) as {
  headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;
};
const deployed = (key: string) =>
  vercel.headers.find((rule) => rule.source === "/(.*)")?.headers.find((header) => header.key === key)?.value;

describe("document policy", () => {
  it("is the policy vercel.json serves, trusting the boot script by hash", () => {
    expect(deployed("Content-Security-Policy")).toBe(contentSecurityPolicy({ bootScriptHash: hash }));
    expect(deployed("Content-Security-Policy")).toContain(`'sha256-${hash}' 'strict-dynamic'`);
  });

  it("trusts no inline script by blanket permission", () => {
    const policy = contentSecurityPolicy({ bootScriptHash: hash });
    const scripts = policy.split("; ").find((directive) => directive.startsWith("script-src"));
    expect(scripts).not.toContain("'unsafe-inline'");
    expect(scripts).not.toContain("'unsafe-eval'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("base-uri 'self'");
  });

  it("reaches loopback only for the isolated test stack", () => {
    expect(contentSecurityPolicy({ bootScriptHash: hash })).not.toMatch(/127\.0\.0\.1|localhost/u);
    expect(contentSecurityPolicy({ bootScriptHash: hash, local: true })).toContain("ws://127.0.0.1:*");
    expect(isIsolatedLocalBuild({ allowedDomain: "integration.invalid", authEmulatorUrl: "http://127.0.0.1:9099" })).toBe(true);
    expect(isIsolatedLocalBuild({ allowedDomain: "school.edu.tw", authEmulatorUrl: "http://127.0.0.1:9099" })).toBe(false);
    expect(isIsolatedLocalBuild({ allowedDomain: "integration.invalid", authEmulatorUrl: "https://evil.example:9099" })).toBe(false);
  });

  it("starts only same-origin bundles from the entry meta tag", () => {
    expect(DOCUMENT_BOOT_SCRIPT).toContain(String.raw`/^\/assets\/[\w.-]+\.js$/`);
  });
});
