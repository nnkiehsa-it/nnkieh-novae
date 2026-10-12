"use client";

import * as React from "react";
import { AppLink } from "./app-link";
import { motion } from "motion/react";
import type { Icon } from "@phosphor-icons/react";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

export interface NavItem {
  badge?: boolean;
  href: string;
  icon: Icon;
  label: string;
}

/**
 * The primary destinations, in one of two shapes:
 * - `dock`: the floating bar at the bottom of a phone, icon over label;
 * - `rail`: a column of icon-and-label rows down the side of a wide screen.
 * The current destination always wears the white pill, and its icon fills.
 */
export function PrimaryNav({
  activeHref,
  className,
  items,
  label,
  variant,
}: {
  activeHref: string | null;
  className?: string;
  items: NavItem[];
  label: string;
  variant: "dock" | "rail";
}) {
  const pillId = React.useId();
  return (
    <nav
      aria-label={label}
      className={cn(
        "flex",
        variant === "dock" && "glass h-[var(--bottom-nav-height)] items-stretch gap-1 rounded-full p-1.5 shadow-float",
        variant === "rail" && "flex-col gap-1",
        className,
      )}
    >
      {items.map(({ badge, href, icon: ItemIcon, label: itemLabel }) => {
        const active = href === activeHref;
        return (
          <AppLink
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative isolate flex min-w-0 items-center rounded-full font-medium outline-none transition-[color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
              active ? "text-on-contrast" : "text-ink-muted hover:text-ink",
              variant === "dock" && "flex-1 flex-col justify-center gap-0.5 text-[0.6875rem]",
              variant === "rail" && "h-11 gap-3 px-3.5 text-[0.9375rem]",
            )}
            href={href}
            key={href}
          >
            {active ? (
              <motion.span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-full bg-contrast"
                initial={false}
                layoutId={pillId}
                transition={timing("nav", "nav")}
              />
            ) : null}
            <span aria-hidden className="relative">
              <ItemIcon className="size-5" weight={active ? "fill" : "regular"} />
              {badge ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-danger" /> : null}
            </span>
            <span className="max-w-full truncate px-1">{itemLabel}</span>
          </AppLink>
        );
      })}
    </nav>
  );
}
