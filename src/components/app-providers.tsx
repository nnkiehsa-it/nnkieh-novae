"use client";

import { Suspense, useEffect, useState, type ReactNode } from "react";
import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import { SessionProvider } from "@/hooks/use-session";
import { initializeI18n } from "@/i18n";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { AppUpdateGate } from "@/components/app-update-gate";
import { E2eAuthBridge } from "@/components/e2e-auth-bridge";
import { TurnstileProvider } from "@/components/turnstile-provider";
import { AppInstallPrompt } from "@/components/app-install-prompt";
import { ensureFirebaseAppCheck } from "@/lib/firebase-app-check";

export function AppProviders({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string;
}) {
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    initializeI18n();
    void ensureFirebaseAppCheck().catch(() => undefined);
    setI18nReady(true);
  }, []);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
    >
      <MotionConfig
        reducedMotion="user"
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        <TooltipProvider>
          <TurnstileProvider nonce={nonce}>
            <SessionProvider>
              <Suspense fallback={null}>
                {i18nReady ? children : <div className="app-start-surface" />}
              </Suspense>
            </SessionProvider>
            <E2eAuthBridge />
            <AppUpdateGate />
            <AppInstallPrompt />
            <Toaster position="bottom-center" />
          </TurnstileProvider>
        </TooltipProvider>
      </MotionConfig>
    </ThemeProvider>
  );
}
