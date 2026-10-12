"use client";

import { CheckCircle, Clock, Database, Warning } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/ui/feedback";
import { ListGroup, ListRow } from "@/ui/list";
import type { PlatformDashboardData } from "@/types";

const STATUS_TONES: Record<string, string> = { attention: "bg-caution", healthy: "bg-positive" };

const MAX_FAILURES = 3;

/**
 * Whether the platform is keeping up. A counter at zero is the absence of a
 * reading, so a platform with nothing wrong says so in one row instead of
 * spending five rows saying nothing five times. Whatever is not zero names
 * itself, and the last row goes to the screen that can do something about it.
 */
export function OperationsHealth({ canOpenSystem, platform }: {
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
  const clear = Boolean(operations) && counters.length === 0 && failures.length === 0;

  return (
    <ListGroup
      title={
        <span className="flex items-center gap-2">
          {operations
            ? <span aria-hidden className={cn("size-2 rounded-full", STATUS_TONES[operations.overall_status] ?? "bg-danger")} />
            : <Skeleton className="size-2 rounded-full" />}
          {t("ui.dashboard.operations")}
        </span>
      }
    >
      {clear ? (
        <ListRow icon={<CheckCircle className="text-positive" />} label={t("ui.dashboard.noFailures")} />
      ) : (
        counters.map((counter) => (
          <ListRow
            key={counter.label}
            label={counter.label}
            value={counter.value === undefined ? <Skeleton className="h-5 w-8" /> : <span className="tabular-nums">{counter.value}</span>}
          />
        ))
      )}
      {failures.slice(0, MAX_FAILURES).map((failure) => (
        <ListRow
          detail={t("ui.dashboard.trace", { id: failure.failure_id })}
          icon={failure.source === "outbox" ? <Database /> : <Clock />}
          key={failure.id}
          label={`${failure.source} · ${failure.status}`}
          tone="danger"
          value={formatDate(failure.updated_at)}
        />
      ))}
      {canOpenSystem ? <ListRow href="/admin/system" icon={<Warning />} label={t("admin.systemTitle")} /> : null}
    </ListGroup>
  );
}
