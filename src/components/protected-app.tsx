"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { useContentRealtime } from "@/hooks/use-content-realtime";
import { AppLocaleGate } from "@/components/app-locale-gate";
import { AppShell } from "@/components/app-shell";
import { BrandLockup } from "@/components/ui/brand";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

export function AppStartupScreen() {
  useLocaleSubscription();
  return (
    <div className="app-start-surface grid place-items-center">
      <div className="t-panel-reveal flex flex-col items-center gap-3 text-center">
        <BrandLockup
          className="flex-col gap-2 [&>span:last-child]:text-2xl"
          markClassName="size-24 rounded-3xl p-4"
        />
        <div className="mt-0.5">
          <p
            className="t-shimmer text-base text-muted-foreground"
            data-text={translate('ui.app.preparing')}
          >{translate('ui.app.preparing')}</p>
        </div>
        <LoadingSpinner className="mt-1 size-8 text-muted-foreground" iconClassName="size-5" />
      </div>
    </div>
  );
}

export function ProtectedApp({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const { initialized, loading, roleLoading, setupCompleted, user } = session;
  useContentRealtime(pathname, Boolean(user && setupCompleted));

  React.useEffect(() => {
    if (!initialized || loading || roleLoading) return;
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
    user,
  ]);

  if (!initialized || loading || roleLoading)
    return <AppStartupScreen />;
  if (!user) return <AppStartupScreen />;
  if (!setupCompleted && pathname !== "/setup")
    return <AppStartupScreen />;
  if (setupCompleted && pathname === "/setup") return <AppStartupScreen />;
  if (pathname === "/setup")
    return <AppLocaleGate>{children}</AppLocaleGate>;
  return (
    <AppLocaleGate>
      <AppShell>{children}</AppShell>
    </AppLocaleGate>
  );
}
