"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import {
  Bell,
  Blocks,
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

function AccountMenu() {
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
          aria-label={translate('ui.nav.accountMenu')}
          className="size-11 rounded-full p-0"
          variant="ghost"
        >
          <Avatar className="size-8">
            <AvatarImage alt={name} src={photo} />
            <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
          </Avatar>
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
  const homeHref = categories.issuesEnabled ? issueHref : categories.facilitiesEnabled ? "/facilities" : "/announcements";
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
    <div className="app-shell bg-[var(--surface-stage)]">
      <AppNotificationPrompt />
      <header className="app-desktop-header fixed inset-x-0 top-0 z-30 hidden h-[var(--desktop-nav-height)] border-b border-border/60 bg-[var(--surface-stage)] md:block">
        <div className="mx-auto flex h-full max-w-[84rem] items-center justify-between gap-6 px-[var(--page-gutter)]">
          <BrandLockup href={homeHref} markClassName="size-10" />
          <LiquidNav
            className="h-11 max-w-3xl flex-1"
            items={navItems}
            pathname={navigationPathname}
            desktop
          />
          <AccountMenu />
        </div>
      </header>

      <div className="app-main-column min-w-0">
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
