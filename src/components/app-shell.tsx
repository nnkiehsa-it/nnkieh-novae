"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  Bell,
  Blocks,
  ChevronDown,
  LogOut,
  Megaphone,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Wrench,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCategories } from "@/hooks/use-categories";
import { useNotificationBadge } from "@/hooks/use-notification-badge";
import { usePushTokenHeartbeat } from "@/hooks/use-push-token-heartbeat";
import { rememberCurrentRoute } from "@/lib/navigation-memory";
import { publishStageNavigationCommit } from "@/lib/stage-depth";
import { useSession } from "@/hooks/use-session";
import { getDefaultIssueRouteFilter } from "@/constants/categories";
import { LiquidNav, type LiquidNavItem } from "@/components/liquid-nav";
import { AppNotificationPrompt } from "@/components/app-notification-prompt";
import { RouteSurface } from "@/components/motion/route-surface";
import { adoptedParent, showsPrimaryNavigation } from "@/lib/route-hierarchy";

function MobileNavigationPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
import { useSurfaceRoute } from "@/hooks/use-surface-route";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/ui/brand";
import { ActionMenu, type ActionMenuItem } from "@/components/ui/action-menu";

function NotificationDot({ unread }: { unread: boolean }) {
  useLocaleSubscription();
  return (
    <span
      aria-hidden
      className="t-notification-badge absolute -right-1 -top-0.5 size-2 rounded-full bg-destructive ring-2 ring-background"
      data-open={unread}
    />
  );
}

function AccountMenu({ compact = false }: { compact?: boolean }) {
  const session = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const photo = session.customPhotoUrl || session.user?.photoURL || undefined;
  const name = session.user?.displayName || session.user?.email || "Novae";
  const changeTheme = React.useCallback(() => {
    const update = () => setTheme(resolvedTheme === "dark" ? "light" : "dark");
    if (
      !("startViewTransition" in document) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      update();
      return;
    }
    document.documentElement.dataset.themeTransition = "true";
    const transition = document.startViewTransition(async () => {
      update();
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    });
    void transition.finished.finally(() => {
      delete document.documentElement.dataset.themeTransition;
    });
  }, [resolvedTheme, setTheme]);
  const items: ActionMenuItem[] = [
    {
      href: "/settings",
      icon: Settings,
      key: "settings",
      label: translate('ui.nav.settings'),
    },
    ...(session.can("dashboard.view") || session.can("role.manage") || session.can("category.manage")
      ? [{
          href: "/admin",
          icon: ShieldCheck,
          key: "admin",
          label: translate('admin.title'),
        }]
      : []),
    {
      icon: resolvedTheme === "dark" ? Sun : Moon,
      key: "theme",
      label: resolvedTheme === "dark"
        ? translate('ui.nav.lightMode')
        : translate('ui.nav.darkMode'),
      onSelect: changeTheme,
    },
    {
      icon: LogOut,
      key: "sign-out",
      label: translate('ui.nav.signOut'),
      onSelect: () => void session.logout(),
    },
  ];

  return (
    <ActionMenu
      className="w-60"
      description={session.user?.email ?? undefined}
      items={items}
      title={name}
      trigger={
        <Button
          aria-label={compact ? translate('ui.nav.accountMenu') : undefined}
          className={
            compact
              ? "size-9 rounded-full p-0"
              : "h-auto w-full justify-start gap-2.5 rounded-xl p-2 text-left"
          }
          variant="ghost"
        >
          <Avatar className="size-8">
            <AvatarImage alt={name} src={photo} />
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
          {compact ? null : (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {session.user?.email}
                </span>
              </span>
              <ChevronDown className="t-disclosure-icon size-3.5 text-muted-foreground" />
            </>
          )}
        </Button>
      }
    />
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  usePushTokenHeartbeat();
  const { t } = useLocaleSubscription();
  const pathname = usePathname();
  // A record opened over the list it is in is still that list as far as the
  // shell is concerned: the bar keeps pointing where it pointed.
  const { surface } = useSurfaceRoute();
  const categories = useCategories();
  const unread = useNotificationBadge();
  const issueHref = `/issues/${encodeURIComponent(getDefaultIssueRouteFilter())}`;
  const showMobileNavigation = showsPrimaryNavigation(surface);

  React.useEffect(() => {
    rememberCurrentRoute(pathname);
    publishStageNavigationCommit(pathname);
  }, [pathname]);

  const navItems = React.useMemo<LiquidNavItem[]>(
    () => [
      ...(categories.issuesEnabled
        ? [
            {
              activePathPrefix: "/issues",
              href: issueHref,
              icon: <Blocks className="size-[1.125rem]" />,
              label: t('ui.nav.issues'),
            },
          ]
        : []),
      ...(categories.facilitiesEnabled
        ? [
            {
              href: "/facilities",
              icon: <Wrench className="size-[1.125rem]" />,
              label: t('ui.nav.facilities'),
            },
          ]
        : []),
      {
        href: "/announcements",
        icon: <Megaphone className="size-[1.125rem]" />,
        label: t('ui.nav.announcements'),
      },
      {
        href: "/notifications",
        icon: <Bell className="size-[1.125rem]" />,
        label: t('ui.nav.notifications'),
        badge: <NotificationDot unread={unread} />,
      },
      {
        href: "/settings",
        icon: <Settings className="size-[1.125rem]" />,
        label: t('ui.nav.settings'),
      },
    ],
    [categories.facilitiesEnabled, categories.issuesEnabled, issueHref, t, unread],
  );

  const navigationPathname = adoptedParent(surface) ?? surface;
  return (
    <div className="app-shell bg-[var(--surface-stage)] md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <AppNotificationPrompt />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-card p-3 md:flex">
        <div className="mb-4 border-b px-3 pb-5 pt-3">
          <BrandLockup href={issueHref} />
        </div>
        <LiquidNav
          className="flex-1 content-start"
          items={navItems}
          pathname={navigationPathname}
          vertical
        />
        <div className="mt-auto border-t pt-2">
          <AccountMenu />
        </div>
      </aside>

      <div className="app-main-column min-w-0 md:col-start-2">
        <main className="app-viewport">
          <RouteSurface
            className={`pt-[var(--page-header-top)] md:pb-12 ${
              showMobileNavigation
                ? "pb-[calc(var(--mobile-nav-height)+var(--mobile-nav-bottom-gap)+1.4rem)]"
                : "pb-[max(2rem,var(--safe-bottom))]"
            }`}
          >
            {children}
          </RouteSurface>
        </main>

        <MobileNavigationPortal>
          <div
            aria-hidden={!showMobileNavigation}
            className="app-mobile-nav fixed z-30 mx-auto max-w-md rounded-full border bg-card px-3 py-1.5 shadow-[var(--shadow-floating)] md:hidden"
            data-visible={showMobileNavigation}
            inert={!showMobileNavigation}
          >
            <LiquidNav
              className="mx-auto h-12"
              items={navItems}
              pathname={navigationPathname}
            />
          </div>
        </MobileNavigationPortal>
      </div>
    </div>
  );
}
