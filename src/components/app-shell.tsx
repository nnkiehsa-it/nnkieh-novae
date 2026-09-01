"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  Blocks,
  ChevronDown,
  Gauge,
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
import { useRoutePreload } from "@/hooks/use-route-preload";
import { usePushTokenHeartbeat } from "@/hooks/use-push-token-heartbeat";
import { rememberCurrentRoute } from "@/lib/navigation-memory";
import { useSession } from "@/hooks/use-session";
import { getDefaultIssueRouteFilter } from "@/constants/categories";
import { LiquidNav, type LiquidNavItem } from "@/components/liquid-nav";
import { AppNotificationPrompt } from "@/components/app-notification-prompt";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { BrandLockup } from "@/components/ui/brand";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

function isSecondaryMobileRoute(pathname: string) {
  if (pathname === "/dashboard" || pathname.startsWith("/admin/")) return true;
  if (pathname === "/issues/my-proposals") return true;
  return (
    /^\/issues\/[^/]+\/(?:new|[^/]+)$/u.test(pathname) ||
    /^\/facilities\/(?:new|[^/]+)$/u.test(pathname) ||
    /^\/announcements\/(?:new|[^/]+)$/u.test(pathname)
  );
}

function AccountMenu({ compact = false }: { compact?: boolean }) {
  const session = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const photo = session.customPhotoUrl || session.user?.photoURL || undefined;
  const name = session.user?.displayName || session.user?.email || "Novae";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
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
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {session.user?.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings />{translate('ui.nav.settings')}</Link>
        </DropdownMenuItem>
        {session.can("dashboard.view") ? (
          <DropdownMenuItem asChild>
            <Link href="/dashboard">
              <Gauge />{translate('ui.nav.dashboard')}</Link>
          </DropdownMenuItem>
        ) : null}
        {session.can("role.manage") ? (
          <DropdownMenuItem asChild>
            <Link href="/admin/management">
              <ShieldCheck />{translate('ui.nav.management')}</Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <span className="t-icon-swap">
            <Sun data-visible={resolvedTheme === "dark"} />
            <Moon data-visible={resolvedTheme !== "dark"} />
          </span>
          {resolvedTheme === "dark" ? translate('ui.nav.lightMode') : translate('ui.nav.darkMode')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void session.logout()}>
          <LogOut />{translate('ui.nav.signOut')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  useRoutePreload();
  usePushTokenHeartbeat();
  const { t } = useLocaleSubscription();
  const pathname = usePathname();
  const categories = useCategories();
  const unread = useNotificationBadge();
  const [scrolled, setScrolled] = React.useState(false);
  const issueHref = `/issues/${encodeURIComponent(getDefaultIssueRouteFilter())}`;
  const showMobileNavigation = !isSecondaryMobileRoute(pathname);

  React.useEffect(() => rememberCurrentRoute(pathname), [pathname]);

  React.useEffect(() => {
    const updateScrolled = () => setScrolled(window.scrollY > 8);
    updateScrolled();
    window.addEventListener("scroll", updateScrolled, { passive: true });
    return () => window.removeEventListener("scroll", updateScrolled);
  }, []);

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

  const navigationPathname =
    pathname.startsWith("/admin/") || pathname === "/dashboard"
      ? "/settings"
      : pathname;
  return (
    <div className="app-shell bg-[var(--surface-stage)] md:grid md:grid-cols-[15rem_minmax(0,1fr)]">
      <AppNotificationPrompt />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-background/92 p-3 backdrop-blur-xl md:flex">
        <div className="px-2 pb-5 pt-2">
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

      <div className="min-w-0 md:col-start-2">
        <div aria-hidden className="app-top-blur" data-visible={scrolled} />
        <main
          className={`app-viewport pt-[max(1rem,var(--safe-top))] md:pb-12 md:pt-6 ${
            showMobileNavigation
              ? "pb-[calc(var(--mobile-nav-height)+var(--mobile-nav-bottom-gap)+1.4rem)]"
              : "pb-[max(2rem,var(--safe-bottom))]"
          }`}
        >
          <div className="route-page">{children}</div>
        </main>

        <div
          aria-hidden={!showMobileNavigation}
          className="app-mobile-nav fixed z-30 mx-auto max-w-md rounded-full border bg-background/92 px-3 py-1.5 shadow-[var(--shadow-floating)] backdrop-blur-xl md:hidden"
          data-visible={showMobileNavigation}
          inert={!showMobileNavigation}
        >
          <LiquidNav
            className="mx-auto h-12"
            items={navItems}
            pathname={navigationPathname}
          />
        </div>
      </div>
    </div>
  );
}
