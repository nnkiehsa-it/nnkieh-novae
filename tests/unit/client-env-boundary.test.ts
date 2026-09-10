import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, it } from "vitest";

const CLIENT_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const FORBIDDEN_SERVER_ENV = [
  "ADMIN_EMAILS",
  "CLOUDINARY_API_SECRET",
  "DATABASE_URL",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "HEALTHCHECK_SECRET",
  "MEDIA_SIGNING_SECRET",
  "NOTION_TOKEN",
  "REALTIME_TICKET_SECRET",
  "TURNSTILE_SECRET_KEY",
] as const;
const SECRETISH_PUBLIC_ENV = /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|PASSWORD|PRIVATE|SERVICE_ACCOUNT|DATABASE_URL|ADMIN_EMAILS|SIGNING_KEY)/gu;

function sourceFiles(root: string): string[] {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return CLIENT_EXTENSIONS.has(extname(entry.name)) ? [path] : [];
  });
}

describe("client environment boundary", () => {
  it("does not reference backend secrets from frontend source or publish secret-shaped env names", () => {
    const root = process.cwd();
    const files = [...sourceFiles(join(root, "src")), join(root, "next.config.mjs")];
    const violations: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const name of FORBIDDEN_SERVER_ENV) {
        if (source.includes(`process.env.${name}`) || source.includes(`process.env["${name}"]`)) {
          violations.push(`${file}: server-only env ${name}`);
        }
      }
      for (const match of source.matchAll(SECRETISH_PUBLIC_ENV)) {
        violations.push(`${file}: suspicious public env ${match[0]}`);
      }
    }

    expect(violations).toEqual([]);
  });
});
