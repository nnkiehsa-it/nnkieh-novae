"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Bell, CaretUpDown, GearSix, House, ShieldCheck, SignOut, SquaresFour } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { canEnterAdministration } from "@/lib/admin-routes";
import { hidesDock, primaryDestination } from "@/lib/route-hierarchy";
import { cn } from "@/lib/utils";
import { useNotificationBadge } from "@/hooks/use-notification-badge";
import { usePushTokenHeartbeat } from "@/hooks/use-push-token-heartbeat";
import { useSession } from "@/hooks/use-session";
import { NotificationPrompt } from "@/features/system/notification-prompt";
import { Avatar } from "@/ui/avatar";
import { Menu, type MenuItem } from "@/ui/menu";
import { PrimaryNav, type NavItem } from "@/ui/nav";

function AccountMenu() {
  const session = useSession();
  const { t } = useI18n();
  const name = session.user?.displayName || session.user?.email || "Novae";
  const administers = canEnterAdministration({
    admin: session.isAdmin,
    categories: session.can("category.manage"),
    members: session.can("role.manage"),
    overview: session.can("dashboard.view"),
  });
  const items: MenuItem[] = [
    { href: "/settings", icon: GearSix, key: "settings", label: t("ui.nav.settings") },
    ...(administers ? [{ href: "/admin", icon: ShieldCheck, key: "admin", label: t("admin.title") }] : []),
    { icon: SignOut, key: "sign-out", label: t("ui.nav.signOut"), onSelect: () => void session.logout(), tone: "danger" },
  ];
  return (
    <Menu
      align="start"
      description={session.user?.email ?? undefined}
      items={items}
      title={name}
      trigger={
        <button
          aria-label={t("ui.nav.accountMenu")}
          className="flex w-full items-center gap-2.5 rounded-tile px-2 py-1.5 text-left outline-none transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          type="button"
        >
          <Avatar className="size-7" name={name} src={session.customPhotoUrl} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
          <CaretUpDown aria-hidden className="size-4 shrink-0 text-ink-faint" />
        </button>
      }
    />
  );
}

/**
 * The signed-in frame: a glass sidebar beside the page on a wide screen, a
 * floating dock beneath it on a phone.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  usePushTokenHeartbeat();
  const { t } = useI18n();
  const pathname = usePathname();
  const unread = useNotificationBadge();
  const dock = !hidesDock(pathname);
  const items = React.useMemo<NavItem[]>(() => [
    { href: "/home", icon: House, label: t("ui.nav.home") },
    { href: "/feed", icon: SquaresFour, label: t("ui.nav.feed") },
    { badge: unread, href: "/notifications", icon: Bell, label: t("ui.nav.notifications") },
    { href: "/settings", icon: GearSix, label: t("ui.nav.settings") },
  ], [t, unread]);
  const active = primaryDestination(pathname);

  return (
    <div className="min-h-svh md:pl-66">
      <NotificationPrompt />
      <aside className="glass fixed inset-y-3 left-3 z-30 hidden w-60 flex-col gap-3 rounded-panel border border-line p-2.5 shadow-panel md:flex">
        {/* Whose Novae this is, where Notion puts the workspace: the account
            menu opens settings, administration and sign-out from here. */}
        <AccountMenu />
        <PrimaryNav activeHref={active} className="flex-1" items={items} label={t("ui.nav.primary")} variant="rail" />
      </aside>
      <main
        className={cn(
          "mx-auto w-full max-w-5xl px-[var(--gutter)] md:px-8 md:pb-12",
          dock ? "pb-[calc(var(--bottom-nav-height)+var(--bottom-nav-gap)+1.5rem)]" : "pb-[max(2rem,var(--safe-bottom))]",
        )}
      >
        {children}
      </main>
      {/* Content scrolling off the bottom fades under the dock, or under the
          window's edge on a wide screen, instead of being cut off. */}
      <div
        aria-hidden
        className={cn(
          "edge-bottom pointer-events-none fixed inset-x-0 bottom-0 z-20 md:left-66 md:h-6",
          dock ? "h-[calc(var(--bottom-nav-height)+var(--bottom-nav-gap)+0.5rem)]" : "h-[var(--safe-bottom)]",
        )}
      />
      <div
        aria-hidden={!dock}
        className={cn(
          "fixed inset-x-[var(--gutter)] bottom-[var(--bottom-nav-gap)] z-30 mx-auto max-w-md transition-[opacity,translate] duration-[var(--motion-nav)] ease-[var(--ease-nav)] md:hidden",
          dock ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-6 opacity-0",
        )}
        inert={!dock}
      >
        <PrimaryNav activeHref={active} items={items} label={t("ui.nav.primary")} variant="dock" />
      </div>
    </div>
  );
}
