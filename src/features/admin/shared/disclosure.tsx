import type * as React from "react";
import { CaretDown } from "@phosphor-icons/react/ssr";

/** Folds secondary material away so a long settings page stays scannable; native, so keyboard and find-in-page work. */
export function Disclosure({ children, defaultOpen = false, title }: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  title: string;
}) {
  return (
    <details className="group grid gap-2" open={defaultOpen}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-full px-1 text-sm font-medium text-ink-muted outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] [&::-webkit-details-marker]:hidden">
        {title}
        <CaretDown aria-hidden className="size-4 shrink-0 transition-transform duration-[var(--motion-control)] group-open:rotate-180" weight="bold" />
      </summary>
      {children}
    </details>
  );
}
