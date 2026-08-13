"use client";

import { useEffect } from "react";

const e2eAuthAvailable =
  process.env.NEXT_PUBLIC_ALLOWED_DOMAIN === "integration.invalid" &&
  /^http:\/\/(?:127\.0\.0\.1|localhost):9099\/?$/u.test(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL ?? "",
  );

export function E2eAuthBridge() {
  useEffect(() => {
    if (!e2eAuthAvailable) return;
    let active = true;
    void import("@/testing/e2e-auth")
      .then(async ({ signInForE2e }) => {
        if (!active) return;
        window.__NOVAE_E2E__ = { signIn: signInForE2e };
        if (process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH === "true") {
          await signInForE2e(
            process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH_EMAIL ||
              "admin@integration.invalid",
          );
        }
      })
      .catch((error: unknown) => {
        console.error("Unable to initialize the isolated E2E auth bridge.", error);
      });
    return () => {
      active = false;
      delete window.__NOVAE_E2E__;
    };
  }, []);

  return null;
}
