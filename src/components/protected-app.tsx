"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { AppShell } from "@/components/app-shell";
import { BrandLockup } from "@/components/ui/brand";

function StartupScreen() {
  useLocaleSubscription();
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background p-6">
      <div className="t-panel-reveal flex flex-col items-center gap-4 text-center">
        <BrandLockup className="flex-col gap-2 text-xl" markClassName="size-20 rounded-2xl [&_img]:size-16" />
        <div>
          <p
            className="t-shimmer text-base text-muted-foreground"
            data-text={translate('ui.app.preparing')}
          >{translate('ui.app.preparing')}</p>
        </div>
        <LoaderCircle className="t-spinner size-5 text-muted-foreground" />
      </div>
    </div>
  );
}

export function ProtectedApp({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();

  React.useEffect(() => {
    if (!session.initialized || session.loading || session.roleLoading) return;
    if (!session.user) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!session.setupCompleted && pathname !== "/setup") {
      router.replace("/setup");
      return;
    }
    if (session.setupCompleted && pathname === "/setup")
      router.replace("/issues");
  }, [
    pathname,
    router,
    session.initialized,
    session.loading,
    session.roleLoading,
    session.setupCompleted,
    session.user,
  ]);

  if (!session.initialized || session.loading || session.roleLoading)
    return <StartupScreen />;
  if (!session.user) return <StartupScreen />;
  if (!session.setupCompleted && pathname !== "/setup")
    return <StartupScreen />;
  if (session.setupCompleted && pathname === "/setup") return <StartupScreen />;
  if (pathname === "/setup") return <>{children}</>;
  return <AppShell>{children}</AppShell>;
}
