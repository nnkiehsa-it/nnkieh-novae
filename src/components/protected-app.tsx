"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { useContentRealtime } from "@/hooks/use-content-realtime";
import { AppLocaleGate } from "@/components/app-locale-gate";
import { AppShell } from "@/components/app-shell";
import { AppStartupScreen } from "@/components/app-startup-screen";
import { useStartupPresentation } from "@/hooks/use-startup-presentation";
import { RouteSurface } from "@/components/motion/route-surface";

export function ProtectedApp({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const { initialized, loading, roleLoading, setupCompleted, startupError, user } = session;
  const { phase: startupPhase, pending: presentingStartup } = useStartupPresentation(session);
  const [retainedUid, setRetainedUid] = React.useState<string | null>(null);
  const hasRetainedSession = Boolean(user && retainedUid === user.uid);
  useContentRealtime(pathname, Boolean(user && setupCompleted && !roleLoading && !startupError && !presentingStartup));

  React.useEffect(() => {
    if (!user) {
      setRetainedUid(null);
      return;
    }
    if (!loading && !roleLoading && !startupError && !presentingStartup) setRetainedUid(user.uid);
  }, [loading, roleLoading, startupError, user, presentingStartup]);

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
      router.replace("/home");
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
    !initialized || loading || roleLoading || presentingStartup
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
