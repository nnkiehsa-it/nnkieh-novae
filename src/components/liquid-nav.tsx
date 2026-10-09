"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export interface LiquidNavItem {
  activePathPrefix?: string;
  badge?: ReactNode;
  href: string;
  icon: ReactNode;
  label: string;
}
function NavigationContents({ item }: { item: LiquidNavItem }) {
  const { pending } = useLinkStatus();
  return (
    <>
      <span className="relative shrink-0" data-nav-icon>
        {item.icon}
        {item.badge}
      </span>
      <span className="tabbar-label min-w-0 truncate aria-busy:opacity-50" aria-busy={pending}>
        {item.label}
      </span>
    </>
  );
}
export function LiquidNav({
  className,
  items,
  pathname,
  vertical = false,
}: {
  className?: string;
  items: LiquidNavItem[];
  pathname: string;
  vertical?: boolean;
}) {
  const { t } = useI18n();
  return (
    <nav
      aria-label={t("ui.nav.primary")}
      data-primary-navigation
      className={cn(
        vertical
          ? "list menu-list m-0 grid gap-1"
          : "toolbar tabbar tabbar-icons",
        className,
      )}
    >
      <div className={cn(vertical ? "grid gap-1" : "toolbar-inner")}>
        {items.map((item, index) => {
          const active =
            pathname === item.href ||
            pathname.startsWith(`${item.href}/`) ||
            Boolean(
              item.activePathPrefix &&
              (pathname === item.activePathPrefix ||
                pathname.startsWith(`${item.activePathPrefix}/`)),
            );
          return (
            <Link
              aria-current={active ? "page" : undefined}
              data-liquid-nav-index={index}
              data-active={active}
              className={cn(
                "t-primary-nav-link min-w-0",
                vertical
                  ? "item-link flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm"
                  : "tab-link flex flex-1 flex-col items-center justify-center gap-1 px-1 text-[0.6875rem]",
                active
                  ? "tab-link-active text-tint-content"
                  : "text-muted-foreground",
                active && vertical && "bg-accent",
              )}
              href={item.href}
              key={item.href}
              prefetch
            >
              <NavigationContents item={item} />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
