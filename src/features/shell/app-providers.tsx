import * as React from "react";
import { MotionConfig } from "motion/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { initializeI18n } from "@/i18n";
import { installBrowserBehavior } from "@/lib/browser-behavior";
import { queryClient } from "@/lib/query-client";
import { ensureFirebaseAppCheck } from "@/lib/firebase-app-check";
import { timing } from "@/lib/motion-timing";
import { watchSystemTheme } from "@/lib/theme";
import { SessionProvider } from "@/hooks/use-session";
import { TurnstileProvider } from "@/features/security/turnstile";
import { E2eAuthBridge } from "@/features/system/e2e-auth-bridge";
import { InstallPrompt } from "@/features/system/install-prompt";
import { UpdateGate } from "@/features/system/update-gate";
import { Toaster } from "@/ui/feedback";
import { TooltipProvider } from "@/ui/popover";

export function AppProviders({ children }: { children: React.ReactNode }) {
  // Messages load from the stored locale on the client, so nothing renders
  // until they have: a first paint in the wrong language would flash.
  const [i18nReady, setI18nReady] = React.useState(false);

  React.useEffect(() => {
    initializeI18n();
    void ensureFirebaseAppCheck().catch(() => undefined);
    setI18nReady(true);
    const stopWatchingTheme = watchSystemTheme();
    const uninstallBrowserBehavior = installBrowserBehavior();
    return () => {
      stopWatchingTheme();
      uninstallBrowserBehavior();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion="user" transition={timing("control")}>
        <TooltipProvider>
          <TurnstileProvider>
            <SessionProvider>
              <React.Suspense fallback={null}>{i18nReady ? children : null}</React.Suspense>
            </SessionProvider>
            <E2eAuthBridge />
            <UpdateGate />
            <InstallPrompt />
            <Toaster />
          </TurnstileProvider>
        </TooltipProvider>
      </MotionConfig>
    </QueryClientProvider>
  );
}
