"use client";
import { t as translate, useI18n as useLocaleSubscription, type MessageKey } from "@/i18n";

import * as React from "react";
import { toast } from "sonner";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { useContentRealtime } from "@/hooks/use-content-realtime";
import { AppLocaleGate } from "@/components/app-locale-gate";
import { AppShell } from "@/components/app-shell";
import { BrandLockup } from "@/components/ui/brand";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { RouteSurface } from "@/components/motion/route-surface";
import type { StartupPhase } from "@/hooks/session-store";

const STARTUP_LABELS = {
  session: ["ui.app.startup.session", "ui.app.startup.sessionWaiting"],
  security: ["ui.app.startup.security", "ui.app.startup.securityWaiting"],
  account: ["ui.app.startup.account", "ui.app.startup.accountWaiting"],
  profile: ["ui.app.startup.profile", "ui.app.startup.profileWaiting"],
  access: ["ui.app.startup.access", "ui.app.startup.accessWaiting"],
  content: ["ui.app.startup.content", "ui.app.startup.contentWaiting"],
  ready: ["ui.app.startup.ready"],
} as const satisfies Record<StartupPhase, readonly MessageKey[]>;

const STARTUP_MESSAGE_INTERVAL_MS = 1_800;

function StartupStatus({ phase }: { phase: StartupPhase }) {
  const labels = STARTUP_LABELS[phase];
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (labels.length < 2) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % labels.length);
    }, STARTUP_MESSAGE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [labels]);

  const label = translate(labels[index]);
  return (
    <div className="t-startup-status mt-0.5 min-h-6">
      <span className="sr-only" role="status">{translate(labels[0])}</span>
      <p
        aria-hidden="true"
        className="t-shimmer text-base text-muted-foreground"
        data-text={label}
        key={index}
      >{label}</p>
    </div>
  );
}

export function AppStartupScreen({
  phase = "session",
  error,
  onRetry,
  onSignOut,
}: {
  phase?: StartupPhase;
  error?: string;
  onRetry?: () => Promise<void>;
  onSignOut?: () => Promise<void>;
}) {
  useLocaleSubscription();
  const signOut = useActionFeedback();
  return (
    <div className="app-start-surface grid place-items-center">
      <div className="t-startup-sequence flex flex-col items-center gap-3 text-center">
        <BrandLockup
          className="t-startup-brand flex-col gap-2 [&>span:last-child]:text-2xl"
          markClassName="size-24 rounded-3xl p-4"
        />
        {error ? <div className="grid max-w-sm gap-4 px-5">
          <p role="alert" className="text-sm leading-6 text-muted-foreground">{translate(error)}</p>
          <div className="flex justify-center gap-2">
            {onRetry ? <Button disabled={signOut.busy} onClick={() => void onRetry()}>{translate("common.retry")}</Button> : null}
            {onSignOut ? <Button aria-busy={signOut.busy} disabled={signOut.busy} onClick={() => void signOut.run(onSignOut).catch((caught: unknown) => {
              toast.error(caught instanceof Error ? caught.message : translate("auth.serviceUnavailable"));
            })} variant="ghost">{signOut.busy ? <LoadingSpinner /> : null}{translate("auth.signOutLabel")}</Button> : null}
          </div>
        </div> : <StartupStatus key={phase} phase={phase} />}
      </div>
    </div>
  );
}

export function ProtectedApp({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const { initialized, loading, roleLoading, setupCompleted, startupError, startupPhase, user } = session;
  const [retainedUid, setRetainedUid] = React.useState<string | null>(null);
  const hasRetainedSession = Boolean(user && retainedUid === user.uid);
  useContentRealtime(pathname, Boolean(user && setupCompleted && !roleLoading && !startupError));

  React.useEffect(() => {
    if (!user) {
      setRetainedUid(null);
      return;
    }
    if (!loading && !roleLoading && !startupError) setRetainedUid(user.uid);
  }, [loading, roleLoading, startupError, user]);

  React.useEffect(() => {
    if (!initialized || loading || roleLoading || startupError) return;
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!setupCompleted && pathname !== "/setup") {
      router.replace("/setup");
      return;
    }
    if (setupCompleted && pathname === "/setup")
      router.replace("/issues");
  }, [
    initialized,
    loading,
    pathname,
    roleLoading,
    router,
    setupCompleted,
    startupError,
    user,
  ]);

  if (startupError) return <AppStartupScreen phase={startupPhase} error={startupError} onRetry={session.retryStartup} onSignOut={session.logout} />;

  const waitingForFirstSession = !hasRetainedSession && (
    !initialized || loading || roleLoading
  );
  if (waitingForFirstSession)
    return <AppStartupScreen phase={startupPhase} />;
  if (!user) return <AppStartupScreen phase={startupPhase} />;
  if (!setupCompleted && pathname !== "/setup" && !hasRetainedSession)
    return <AppStartupScreen phase={startupPhase} />;
  if (setupCompleted && pathname === "/setup") return <AppStartupScreen phase={startupPhase} />;
  if (pathname === "/setup")
    return (
      <AppLocaleGate>
        <RouteSurface>{children}</RouteSurface>
      </AppLocaleGate>
    );
  return (
    <AppLocaleGate>
      <AppShell>{children}</AppShell>
    </AppLocaleGate>
  );
}
