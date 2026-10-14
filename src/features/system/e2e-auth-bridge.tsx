"use client";

import { useEffect } from "react";

// Only a build pointed at the local auth emulator with the integration domain
// can expose a test sign-in; every other build compiles this to nothing.
const e2eAuthAvailable =
  process.env.NEXT_PUBLIC_ALLOWED_DOMAIN === "integration.invalid" &&
  /^http:\/\/(?:127\.0\.0\.1|localhost):9099\/?$/u.test(process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ?? "");

export function E2eAuthBridge() {
  useEffect(() => {
    if (!e2eAuthAvailable) return;
    let active = true;
    // A failed import stays an unhandled rejection, so the test run reports it
    // instead of only timing out while waiting for the bridge.
    void import("@/testing/e2e-auth").then(({ signInForE2e }) => {
      if (active) window.__NOVAE_E2E__ = { signIn: signInForE2e };
    });
    return () => {
      active = false;
      delete window.__NOVAE_E2E__;
    };
  }, []);
  return null;
}
