"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

export interface LiquidNavItem {
  activePathPrefix?: string;
  badge?: React.ReactNode;
  href: string;
  icon: React.ReactNode;
  label: string;
}

function NavigationContents({
  item,
  active,
  vertical,
}: {
  item: LiquidNavItem;
  active: boolean;
  vertical: boolean;
}) {
  const { pending } = useLinkStatus();
  const reduceMotion = useReducedMotion();
  return (
    <>
      {active && (
        <motion.span
          aria-hidden
          className="t-nav-selection absolute inset-0 z-0 rounded-[inherit] bg-[var(--nav-active-bg)]"
          layoutId={reduceMotion ? undefined : "selection"}
          transition={timing("nav", "nav")}
        />
      )}
      <span
        aria-hidden
        className="t-nav-pending absolute inset-0 rounded-[inherit]"
        data-pending={pending}
      />
      <span className="relative z-10 shrink-0" data-nav-icon>
        {item.icon}
        {item.badge}
      </span>
      <span
        className={cn(
          "relative z-10 w-full min-w-0 truncate",
          vertical ? "text-left" : "text-center",
        )}
      >
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
  useLocaleSubscription();
  const router = useRouter();
  const groupId = React.useId();
  const activeIndex = items.findIndex(
    (item) =>
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`) ||
      Boolean(
        item.activePathPrefix &&
        (pathname === item.activePathPrefix ||
          pathname.startsWith(`${item.activePathPrefix}/`)),
      ),
  );

  return (
    <LayoutGroup id={groupId}>
      {/* Both shells that hold this bar are taken out of the document flow --
          the sidebar and the floating dock are fixed -- so the moving selection
          has to be measured against the bar itself. Without a layout root it is
          measured against the document and arrives offset by the page scroll,
          which reads as the selection sliding away as the page moves. */}
      <motion.nav
        layoutRoot
        aria-label={translate("ui.nav.primary")}
        data-primary-navigation
        className={cn(
          "relative isolate",
          vertical ? "grid gap-1" : "flex items-stretch",
          className,
        )}
      >
        {items.map((item, index) => {
          const active = index === activeIndex;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={cn(
                "t-primary-nav-link relative flex min-h-10 min-w-0 items-center rounded-[0.625rem] text-sm font-medium text-muted-foreground outline-none transition-[color,transform] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-[var(--surface-hover)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40",
                vertical
                  ? "gap-3 px-3"
                  : "flex-1 flex-col justify-center gap-1 px-1 py-1.5 text-[0.6875rem]",
                active && "text-[var(--nav-active-fg)]",
              )}
              data-liquid-nav-index={index}
              data-active={active}
              href={item.href}
              key={item.href}
              onFocus={() => router.prefetch(item.href)}
              onPointerEnter={() => router.prefetch(item.href)}
            >
              <NavigationContents
                item={item}
                active={active}
                vertical={vertical}
              />
            </Link>
          );
        })}
      </motion.nav>
    </LayoutGroup>
  );
}
