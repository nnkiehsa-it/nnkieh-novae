import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

// One geometry for resolved feeds, route placeholders, and empty states.
export const feedGridClassName = "grid gap-3 lg:grid-cols-2 lg:items-stretch";

export function FeedCard({
  children,
  footer,
  href,
  label,
  metadata,
  pending = false,
  title,
}: {
  children?: ReactNode;
  footer?: ReactNode;
  href?: string;
  label?: string;
  metadata: ReactNode;
  pending?: boolean;
  title: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <div data-slot="feed-card-header" className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="min-h-7 text-lg font-semibold leading-7 tracking-[-0.025em]">
            {title}
          </div>
          <div className="mt-2 flex min-h-6 min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {metadata}
          </div>
        </div>
        {href || pending ? <ArrowUpRight aria-hidden className="mt-1 size-4 shrink-0 text-muted-foreground" /> : null}
      </div>
      {children}
      {footer ? (
        <div data-slot="feed-card-footer" className="mt-auto flex min-h-10 flex-wrap items-center gap-2 pt-2">
          {footer}
        </div>
      ) : null}
      {href ? (
        <Link aria-label={label} className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href} />
      ) : null}
    </div>
  );
}

export function FeedProgress({ children, value }: { children: ReactNode; value?: number }) {
  return (
    <div className="space-y-1.5 rounded-lg bg-secondary px-3 py-2">
      {children}
      <div className="h-1.5 overflow-hidden rounded-full bg-border">
        {value !== undefined ? (
          <span className="block h-full origin-left rounded-full bg-tint-content transition-transform duration-[var(--motion-content)] ease-[var(--ease-arrive)]" style={{ transform: `scaleX(${value / 100})` }} />
        ) : null}
      </div>
    </div>
  );
}
