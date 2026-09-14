"use client";

import { AlertTriangle, CheckCircle2, Clock3, Database } from "lucide-react";

import { useI18n } from "@/i18n";
import { ListNavRow, ListRow, ListSection } from "@/components/ui/list";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import type { PlatformDashboardData } from "@/types";

const statusTint = {
  attention: "bg-warning",
  healthy: "bg-success",
} as const;

/**
 * Whether the platform is currently keeping up.
 *
 * A counter at zero is not a reading, it is the absence of one, so a platform
 * with nothing wrong says so in a single row instead of spending five rows
 * saying nothing five times. Whatever is not zero names itself, and the row
 * underneath goes to the one screen that can do something about it.
 */
export function OverviewHealth({
  canOpenSystem,
  platform,
}: {
  canOpenSystem: boolean;
  platform: PlatformDashboardData | null;
}) {
  const { t } = useI18n();
  const operations = platform?.operations;
  const counters = [
    { label: t("ui.dashboard.pendingNotion"), value: operations?.pending_notion_sync_count },
    { label: t("ui.dashboard.failedDelivery"), value: operations?.failed_delivery_count },
    { label: t("ui.dashboard.failedPush"), value: operations?.failed_push_delivery_count },
    { label: t("ui.dashboard.cleanup"), value: operations?.cleanup_backlog_count },
    { label: t("ui.dashboard.stuckUploads"), value: operations?.stuck_upload_count },
  ].filter((counter) => counter.value === undefined || counter.value > 0);
  const failures = operations?.recent_failures ?? [];
  const settled = Boolean(operations);
  const clear = settled && counters.length === 0 && failures.length === 0;

  return (
    <ListSection
      header={
        <span className="flex items-center gap-2">
          {operations ? (
            <span
              className={`size-2 rounded-full ${
                statusTint[operations.overall_status as keyof typeof statusTint] ?? "bg-destructive"
              }`}
            />
          ) : (
            <Skeleton className="size-2 rounded-full" />
          )}
          {t("ui.dashboard.operations")}
        </span>
      }
    >
      {clear ? (
        <ListRow icon={CheckCircle2} label={t("ui.dashboard.noFailures")} />
      ) : (
        counters.map((counter) => (
          <ListRow
            key={counter.label}
            label={counter.label}
            value={
              counter.value === undefined ? (
                <Skeleton className="h-5 w-8" />
              ) : (
                <span className="tabular-nums">{counter.value}</span>
              )
            }
          />
        ))
      )}
      {failures.slice(0, 3).map((failure) => (
        <ListRow
          detail={t("ui.dashboard.trace", { id: failure.failure_id })}
          icon={failure.source === "outbox" ? Database : Clock3}
          key={failure.id}
          label={`${failure.source} · ${failure.status}`}
          tone="destructive"
          value={formatDate(failure.updated_at)}
        />
      ))}
      {canOpenSystem ? (
        <ListNavRow href="/admin/system" icon={AlertTriangle} label={t("admin.systemTitle")} />
      ) : null}
    </ListSection>
  );
}
