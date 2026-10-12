"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { useContentRealtime } from "@/hooks/use-content-realtime";
import { useSession } from "@/hooks/use-session";
import { useStartupPresentation } from "@/hooks/use-startup-presentation";
import { AppShell } from "./app-shell";
import { AppViews } from "./app-views";
import { LocaleGate } from "./locale-gate";
import { StartupScreen } from "./startup-screen";

/**
 * Everything behind sign-in: holds the startup screen until the session is
 * known, sends a visitor to sign in or to setup, then shows the app. Setup is
 * the one page of its own; every other screen comes from the view host.
 */
export function ProtectedApp({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const { initialized, loading, roleLoading, setupCompleted, startupError, user } = session;
  const { phase, pending: presenting } = useStartupPresentation(session);
  // Once a session has been shown, a later access refresh keeps the app on
  // screen instead of dropping back to the startup screen.
  const [shownUid, setShownUid] = React.useState<string | null>(null);
  const shown = Boolean(user && shownUid === user.uid);
  const settled = initialized && !loading && !roleLoading && !startupError;
  const onSetup = pathname === "/setup";
  useContentRealtime(pathname, Boolean(user && setupCompleted && settled && !presenting));

  React.useEffect(() => {
    if (!user) setShownUid(null);
    else if (settled && !presenting) setShownUid(user.uid);
  }, [presenting, settled, user]);

  React.useEffect(() => {
    if (!settled) return;
    if (!user) router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    else if (!setupCompleted && !onSetup) router.replace("/setup");
    else if (setupCompleted && onSetup) router.replace("/home");
  }, [onSetup, pathname, router, settled, setupCompleted, user]);

  const waiting = Boolean(startupError) || !user || (setupCompleted && onSetup)
    || (!shown && (!settled || presenting || (!setupCompleted && !onSetup)));

  // The app mounts beneath the departing startup screen, so there is never a
  // blank frame between the two.
  return (
    <>
      {waiting ? null : (
        <motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }} transition={timing("reveal")}>
          <LocaleGate>{onSetup ? children : <AppShell><React.Suspense><AppViews /></React.Suspense></AppShell>}</LocaleGate>
        </motion.div>
      )}
      <AnimatePresence initial={false}>
        {waiting ? (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto bg-canvas [background-image:var(--canvas-gradient)]"
            exit={{ opacity: 0, transition: timing("controlExit", "depart") }}
            key="startup"
          >
            <StartupScreen error={startupError} onRetry={session.retryStartup} onSignOut={session.logout} phase={phase} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
