"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { useI18n } from "@/i18n";
import { allowedAdminRoutes, type AdminAccess } from "@/lib/admin-routes";
import { timing } from "@/lib/motion-timing";
import { cn } from "@/lib/utils";

const OVERVIEW_HREF = "/admin";

/**
 * The sections of administration this reader may enter, as a rail of links.
 * It looks like a Segmented control, but each section is its own route.
 */
export function AdminNav({ access }: { access: AdminAccess }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const pillId = React.useId();
  const current = React.useRef<HTMLAnchorElement>(null);
  const items = [
    { href: OVERVIEW_HREF, label: t("admin.overviewTitle") },
    ...allowedAdminRoutes(access).map((route) => ({ href: route.href, label: t(route.labelKey) })),
  ];

  React.useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  return (
    <nav aria-label={t("admin.title")} className="min-w-0 max-w-full justify-self-start">
      <ul className="glass flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1 shadow-panel [scrollbar-width:none]">
        {items.map(({ href, label }) => {
          const selected = href === pathname;
          return (
            <li className="shrink-0" key={href}>
              <Link
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "relative isolate inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-medium outline-none transition-[color] duration-[var(--motion-control)] ease-[var(--ease-move)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  selected ? "text-on-contrast" : "text-ink-muted hover:text-ink",
                )}
                href={href}
                ref={selected ? current : undefined}
              >
                {selected ? (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 -z-10 rounded-full bg-contrast"
                    initial={false}
                    layoutId={pillId}
                    transition={timing("nav", "nav")}
                  />
                ) : null}
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
