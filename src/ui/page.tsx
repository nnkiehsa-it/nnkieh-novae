"use client";

import * as React from "react";
import { AppLink } from "./app-link";
import { ArrowClockwise, CaretLeft, Tray, WarningCircle } from "@phosphor-icons/react/ssr";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Skeleton } from "./feedback";
import { Panel } from "./panel";

/** Pins a page's top row under the status bar while the page scrolls beneath it. */
export const pinnedHeaderClass = "sticky top-[calc(var(--safe-top)+0.75rem)] z-30 md:top-4";

/**
 * The top of a page: an optional way back, the title, and the page's own
 * actions. On a wide screen the actions sit beside the title; on a phone they
 * wrap underneath when they do not fit. Like a large title on iOS, it scrolls
 * away and a small centred title takes its place at the top of the screen.
 */
export function PageHeader({ actions, back, className, description, title }: {
  actions?: React.ReactNode;
  /** Where the back control leads, with its accessible name. */
  back?: { href: string; label: string };
  className?: string;
  description?: React.ReactNode;
  title: React.ReactNode;
}) {
  const titleRef = React.useRef<HTMLHeadingElement>(null);
  const [collapsed, setCollapsed] = React.useState(false);
  React.useEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting && entry.boundingClientRect.top < 0));
    observer.observe(title);
    return () => observer.disconnect();
  }, []);
  return (
    <>
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-30 flex h-[calc(var(--safe-top)+2.75rem)] items-end justify-center px-16 pb-2.5 transition-[opacity,translate] duration-[var(--motion-control)] ease-[var(--ease-move)] md:left-70 md:h-14",
        collapsed ? "opacity-100" : "-translate-y-1 opacity-0",
      )}
    >
      <span className="truncate text-[0.9375rem] font-semibold">{title}</span>
    </div>
    <header className={cn("grid gap-4", className)}>
      {back ? (
        <Button asChild className="justify-self-start" size="icon-sm">
          <AppLink aria-label={back.label} href={back.href}><CaretLeft weight="bold" /></AppLink>
        </Button>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 ref={titleRef} className="text-balance text-2xl font-bold leading-tight tracking-tight md:text-[1.75rem]">{title}</h1>
          {description ? <p className="mt-1 max-w-2xl text-[0.9375rem] leading-relaxed text-ink-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
    </>
  );
}

function StateMessage({ action, description, icon, title, tone = "default" }: {
  action?: React.ReactNode;
  description?: React.ReactNode;
  icon: React.ReactNode;
  title: React.ReactNode;
  tone?: "default" | "danger";
}) {
  return (
    <Panel className="flex flex-col items-center gap-4 px-6 py-10 text-center">
      <span aria-hidden className={cn("grid size-11 place-items-center rounded-full [&_svg]:size-5", tone === "danger" ? "bg-danger/15 text-danger" : "bg-surface-raised text-ink-muted")}>
        {icon}
      </span>
      <div className="grid gap-1">
        <h2 className="text-base font-semibold">{title}</h2>
        {description ? <p className="mx-auto max-w-md text-[0.9375rem] leading-relaxed text-ink-muted">{description}</p> : null}
      </div>
      {action}
    </Panel>
  );
}

export function EmptyState({ action, description, title }: { action?: React.ReactNode; description?: React.ReactNode; title: React.ReactNode }) {
  return <StateMessage action={action} description={description} icon={<Tray />} title={title} />;
}

/** A load that failed, with the reason and a way to try again. */
export function ErrorState({ message, onRetry, retryLabel, title }: {
  message: React.ReactNode;
  onRetry?: () => void;
  retryLabel: string;
  title: React.ReactNode;
}) {
  return (
    <StateMessage
      action={onRetry ? <Button onClick={onRetry}><ArrowClockwise weight="bold" />{retryLabel}</Button> : null}
      description={message}
      icon={<WarningCircle />}
      title={title}
      tone="danger"
    />
  );
}

/** Placeholder rows shaped like the record cards that will replace them. */
export function LoadingList({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div aria-busy="true" aria-label={label} className="grid gap-3" role="status">
      {Array.from({ length: rows }, (_, index) => (
        <Panel className="grid gap-3" key={index}>
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </Panel>
      ))}
    </div>
  );
}
