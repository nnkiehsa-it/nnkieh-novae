import * as React from "react";
import { AppLink } from "@/ui/app-link";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/ui/feedback";

/**
 * One record in a list: chips, a title, the line under it, and a footer of
 * its own controls. The whole card opens the record; the footer's controls sit
 * above the link so they can be pressed on their own.
 */
export function RecordCard({ children, chips, footer, href, label, meta, title }: {
  children?: React.ReactNode;
  chips?: React.ReactNode;
  footer?: React.ReactNode;
  href: string;
  label: string;
  meta?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <article className="glass group relative flex h-full min-w-0 flex-col gap-3 rounded-panel p-4 shadow-panel transition-[background-color] duration-[var(--motion-control)] ease-[var(--ease-move)] hover:bg-surface-raised">
      {chips ? <div className="flex flex-wrap items-center gap-2">{chips}</div> : null}
      <div className="min-w-0">
        <h2 className="line-clamp-2 text-lg font-semibold leading-snug tracking-tight">{title}</h2>
        {meta ? <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">{meta}</div> : null}
      </div>
      {children}
      {footer ? <div className="relative z-10 mt-auto flex flex-wrap items-center gap-2 pt-1">{footer}</div> : null}
      <AppLink
        aria-label={label}
        className="absolute inset-0 rounded-panel outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        href={href}
       
      />
    </article>
  );
}

/** A progress bar inside a card, such as support towards a goal. */
export function CardProgress({ children, color = "var(--contrast)", value }: { children?: React.ReactNode; color?: string; value: number }) {
  return (
    <div className="grid gap-2 rounded-tile bg-surface-raised px-3.5 py-3">
      {children}
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-pressed">
        <span
          className="block h-full origin-left rounded-full transition-transform duration-[var(--motion-reveal)] ease-[var(--ease-arrive)]"
          style={{ background: color, transform: `scaleX(${Math.min(1, Math.max(0, value / 100))})` }}
        />
      </div>
    </div>
  );
}

export function RecordCardSkeleton() {
  return (
    <div aria-hidden className="glass flex flex-col gap-3 rounded-panel p-4 shadow-panel">
      <Skeleton className="h-6 w-16 rounded-chip" />
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-32" />
      <div className="mt-2 flex gap-2"><Skeleton className="h-11 w-20 rounded-full" /></div>
    </div>
  );
}

export const recordGridClass = cn("grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2");
