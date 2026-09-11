"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { timing } from "@/lib/motion-timing";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  actions,
  className,
  description,
  title,
  toolbar,
}: {
  actions?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  title: React.ReactNode;
  /**
   * Search and sort controls. They join the same wrapping row as the title and the
   * actions, which lets them sit beside the actions where the screen is narrow and
   * take a full-width line of their own where it is not.
   */
  toolbar?: React.ReactNode;
}) {
  useLocaleSubscription();
  const heading = (
    <div className={cn("min-w-0", toolbar && "order-1 w-full sm:w-auto sm:flex-1")}>
      <h1 className="text-balance text-2xl font-semibold leading-8 tracking-[-0.035em]">
        {title}
      </h1>
      {description ? (
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
  if (toolbar) {
    return (
      <header className={cn("flex flex-wrap items-center gap-x-2 gap-y-3 pb-4", className)}>
        {heading}
        {actions}
        {toolbar}
      </header>
    );
  }
  return (
    <header
      className={cn(
        "flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {heading}
      {actions ? (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:flex-1 sm:justify-end">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

export function LoadingState({ rows = 5 }: { rows?: number }) {
  return (
    <div className="grid gap-2" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <Card className="gap-3 p-4" key={index}>
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-1/3" />
        </Card>
      ))}
    </div>
  );
}

export function EmptyStateContent({
  action,
  description,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-5 py-8 text-center">
      <div className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
        <Inbox className="size-5" />
      </div>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      </div>
      {action}
    </div>
  );
}

export function ErrorStateContent({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex flex-col items-center gap-4 px-5 py-8 text-center"
      data-error="true"
    >
      <div className="grid size-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </div>
      <div>
        <h2 className="font-semibold">{translate('ui.common.loadFailed')}</h2>
        <p className="mt-1 max-w-lg text-sm leading-6 text-muted-foreground">
          {error}
        </p>
      </div>
      {onRetry ? (
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw />{translate('ui.common.reload')}</Button>
      ) : null}
    </div>
  );
}

export function EmptyState(props: React.ComponentProps<typeof EmptyStateContent>) {
  return <Card className="gap-0 p-0"><EmptyStateContent {...props} /></Card>;
}

export function ErrorState(props: React.ComponentProps<typeof ErrorStateContent>) {
  return <Card className="gap-0 p-0"><ErrorStateContent {...props} /></Card>;
}

export function BusyLabel({
  busy,
  busyLabel,
  label,
  success = false,
}: {
  busy: boolean;
  busyLabel: string;
  label: string;
  success?: boolean;
}) {
  return (
    <span className="inline-grid items-center">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          className="col-start-1 row-start-1 inline-flex items-center gap-2"
          key={busy ? `busy:${busyLabel}` : `idle:${label}`}
          initial={{ opacity: 0, scale: 0.94, y: 5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: -5 }}
          transition={timing("control")}
        >
          {busy ? (
            <ActionFeedbackIcon
              className="bg-transparent [&>svg]:size-4"
              size="sm"
              state={success ? "success" : "loading"}
            />
          ) : null}
          <span
            className={cn(busy && "t-shimmer")}
            data-text={busy ? busyLabel : undefined}
          >
            {busy ? busyLabel : label}
          </span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
