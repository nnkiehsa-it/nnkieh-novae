"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { AlertCircle, Inbox, RefreshCw } from "lucide-react";
import { ActionFeedbackIcon } from "@/components/ui/action-feedback-icon";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function PageHeader({
  actions,
  className,
  title,
}: {
  actions?: React.ReactNode;
  className?: string;
  title: React.ReactNode;
}) {
  useLocaleSubscription();
  return (
    <header
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-balance text-2xl font-semibold leading-8">
          {title}
        </h1>
      </div>
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
        <Card className="t-skeleton gap-3 p-4" key={index}>
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

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  title: string;
}) {
  return (
    <Card className="t-reveal-content items-center px-5 py-12 text-center">
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
    </Card>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry?: () => void;
}) {
  return (
    <Card
      className="t-shake items-center px-5 py-10 text-center"
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
    </Card>
  );
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
    <span className="inline-flex items-center gap-2">
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
    </span>
  );
}
