"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link, { useLinkStatus } from "next/link";
import * as React from "react";
import { motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

export interface LiquidNavItem {
  activePathPrefix?: string;
  badge?: React.ReactNode;
  href: string;
  icon: React.ReactNode;
  label: string;
}

interface SelectionFrame {
  height: number;
  left: number;
  radius: string;
  top: number;
  width: number;
}

function NavigationContents({
  item,
  vertical,
}: {
  item: LiquidNavItem;
  vertical: boolean;
}) {
  const { pending } = useLinkStatus();
  return (
    <>
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

/**
 * Where the selection sits, measured inside the bar.
 *
 * The bar is lifted out of the document flow and its position is written in
 * CSS from the live viewport height, so it moves without React rendering
 * anything. Measuring the selected control against the bar itself — rather
 * than letting a shared-layout animation compare two viewport rectangles taken
 * at different moments — is what keeps the selection on the control it belongs
 * to instead of flying in from wherever the bar used to be.
 */
function useSelectionFrame(
  navRef: React.RefObject<HTMLElement | null>,
  activeIndex: number,
  controlCount: number,
) {
  const [frame, setFrame] = React.useState<SelectionFrame | null>(null);
  React.useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const controls = nav.querySelectorAll<HTMLElement>("[data-liquid-nav-index]");
    const measure = () => {
      const selected = nav.querySelector<HTMLElement>('[data-active="true"]');
      // A bar the breakpoint has taken out of the layout measures as a point,
      // and a selection sized from it would have to fly out of the corner once
      // the bar came back.
      if (!selected?.offsetWidth) return;
      const measured = {
        height: selected.offsetHeight,
        left: selected.offsetLeft,
        radius: getComputedStyle(selected).borderRadius,
        top: selected.offsetTop,
        width: selected.offsetWidth,
      };
      setFrame((current) =>
        current
          && current.height === measured.height
          && current.left === measured.left
          && current.radius === measured.radius
          && current.top === measured.top
          && current.width === measured.width
          ? current
          : measured,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(nav);
    for (const control of controls) observer.observe(control);
    return () => observer.disconnect();
  }, [activeIndex, controlCount, navRef]);
  return frame;
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
  const navRef = React.useRef<HTMLElement>(null);
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
  const frame = useSelectionFrame(navRef, activeIndex, items.length);

  return (
    <nav
      aria-label={translate("ui.nav.primary")}
      data-primary-navigation
      className={cn(
        "relative isolate",
        vertical ? "grid gap-1" : "flex items-stretch",
        className,
      )}
      ref={navRef}
    >
      {frame ? (
        <motion.span
          animate={{
            height: frame.height,
            opacity: activeIndex === -1 ? 0 : 1,
            width: frame.width,
            x: frame.left,
            y: frame.top,
          }}
          aria-hidden
          className="t-nav-selection absolute left-0 top-0 z-0 bg-[var(--nav-active-bg)]"
          initial={false}
          style={{ borderRadius: frame.radius }}
          transition={timing("nav", "nav")}
        />
      ) : null}
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
          >
            <NavigationContents item={item} vertical={vertical} />
          </Link>
        );
      })}
    </nav>
  );
}
