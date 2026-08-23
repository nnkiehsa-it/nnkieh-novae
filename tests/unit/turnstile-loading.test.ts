import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("Turnstile loading", () => {
  it("loads the managed widget before hydration without changing its presentation", () => {
    const layout = read("src/app/layout.tsx");
    const provider = read("src/components/turnstile-provider.tsx");
    expect(layout).toContain('rel="preconnect"');
    expect(layout).toContain('strategy="beforeInteractive"');
    expect(provider).toContain('appearance: "always"');
    expect(provider).toContain('execution: "execute"');
    expect(provider).not.toContain('strategy="afterInteractive"');
  });

  it("keeps the one-time token and Siteverify request path", () => {
    const sessionAuth = read("src/services/session-auth.ts");
    const workerVerification = read("cloudflare/src/turnstile.ts");
    expect(sessionAuth).toContain('"X-Turnstile-Token": token');
    expect(workerVerification).toContain(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
    );
    expect(workerVerification).toContain("validateTurnstileResult(result, env, expectedAction)");
  });

  it("syncs the backend profile only for a newly completed login", () => {
    const session = read("src/hooks/use-session.tsx");
    const e2eAuth = read("src/testing/e2e-auth.ts");

    expect(session).toContain("const freshLogin = consumePreparedLoginEntrance()");
    expect(session).toContain("if (syncProfile)");
    expect(session).toContain("acceptUser(user, tokenValidationPromise, freshLogin)");
    expect(e2eAuth).toContain("await prepareGoogleLoginEntrance()");
  });
});
