"use client";

import { CheckCircle, Clock, Database, Warning } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { Skeleton } from "@/ui/feedback";
import { ListGroup, ListRow } from "@/ui/list";
import type { PlatformDashboard } from "@/hooks/use-admin-overview";

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
  platform: PlatformDashboard | null;
}) {
  const { t } = useI18n();
  const counters = [
    { label: t("ui.dashboard.pendingNotion"), value: platform?.pendingNotionSync },
    { label: t("ui.dashboard.failedDelivery"), value: platform?.failedDeliveries },
    { label: t("ui.dashboard.failedPush"), value: platform?.failedPushDeliveries },
    { label: t("ui.dashboard.cleanup"), value: platform?.cleanupBacklog },
    { label: t("ui.dashboard.stuckUploads"), value: platform?.stuckUploads },
  ].filter((counter) => counter.value === undefined || counter.value > 0);
  const failures = platform?.recentFailures ?? [];
  const clear = Boolean(platform) && counters.length === 0 && failures.length === 0;

  return (
    <ListGroup
      title={
        <span className="flex items-center gap-2">
          {platform
            ? <span aria-hidden className={cn("size-2 rounded-full", STATUS_TONES[platform.status] ?? "bg-danger")} />
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
          detail={failure.failureId ? t("ui.dashboard.trace", { id: failure.failureId }) : undefined}
          icon={failure.source.startsWith("delivery:") ? <Database /> : <Clock />}
          key={failure.id}
          label={`${failure.source} · ${failure.status}`}
          tone="danger"
          value={formatDate(failure.updatedAt)}
        />
      ))}
      {canOpenSystem ? <ListRow href="/admin/system" icon={<Warning />} label={t("admin.systemTitle")} /> : null}
    </ListGroup>
  );
}
