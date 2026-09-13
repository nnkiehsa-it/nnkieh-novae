"use client";

import { useI18n } from "@/i18n";
import type {
  DeletionJob,
  OperationsConsole,
  RetryKind,
} from "@/hooks/use-system-console";
import { ListActionRow, ListRow, ListSection } from "@/components/ui/list";
import { formatDate } from "@/lib/format";

/**
 * The failure surface: work that did not finish, and the one control that asks
 * for it to be tried again.
 */
export function SystemQueue({
  mediaFailures,
  onRetry,
  retrying,
  snapshot,
}: {
  mediaFailures: DeletionJob[];
  onRetry: (kind: RetryKind, id: string) => void;
  retrying: string;
  snapshot: OperationsConsole;
}) {
  const { t } = useI18n();
  const stuck = snapshot.jobs.filter((job) => job.status === "failed");
  const running = snapshot.jobs.filter((job) => job.status !== "failed");
  const nothingWrong =
    stuck.length === 0
    && snapshot.failedDeliveries.length === 0
    && snapshot.cleanupBacklog.length === 0
    && mediaFailures.length === 0
    && snapshot.errors.length === 0;

  return (
    <div className="space-y-6">
      {nothingWrong ? (
        <ListSection header={t("admin.queueHeader")}>
          <ListRow detail={t("admin.queueClearDetail")} label={t("admin.queueClear")} />
        </ListSection>
      ) : null}

      {stuck.length > 0 || snapshot.cleanupBacklog.length > 0 || mediaFailures.length > 0 ? (
        <ListSection footer={t("admin.retryHelp")} header={t("admin.queueFailedHeader")}>
          {stuck.map((job) => (
            <ListActionRow
              busy={retrying === job.id}
              detail={t("admin.jobAttempts", { attempts: job.attemptCount, id: job.id })}
              key={job.id}
              label={job.jobType}
              onClick={() => onRetry("job", job.id)}
              tone="destructive"
              value={t("admin.retry")}
            />
          ))}
          {snapshot.cleanupBacklog.map((entry) => (
            <ListActionRow
              busy={retrying === entry.jobId}
              detail={entry.jobId}
              key={entry.jobId}
              label={t("ui.operations.cleanupBacklog")}
              onClick={() => onRetry("cleanup", entry.jobId)}
              tone="destructive"
              value={t("admin.retry")}
            />
          ))}
          {mediaFailures.map((entry) => (
            <ListActionRow
              busy={retrying === entry.id}
              detail={t("admin.mediaFailureDetail", {
                attempts: entry.attemptCount,
                target: entry.targetId,
                updatedAt: formatDate(entry.updatedAt),
              })}
              key={entry.id}
              label={t("ui.adminConsole.mediaDeletionFailures")}
              onClick={() => onRetry("media", entry.id)}
              tone="destructive"
              value={t("admin.retry")}
            />
          ))}
        </ListSection>
      ) : null}

      {snapshot.failedDeliveries.length > 0 ? (
        <ListSection header={t("ui.operations.deliveries")}>
          {snapshot.failedDeliveries.map((entry) => (
            <ListActionRow
              busy={retrying === entry.id}
              detail={`${entry.eventType} · ${entry.operationId}`}
              key={entry.id}
              label={entry.destination}
              onClick={() => onRetry("delivery", entry.id)}
              tone="destructive"
              value={t("admin.retry")}
            />
          ))}
        </ListSection>
      ) : null}

      {running.length > 0 ? (
        <ListSection header={t("ui.operations.jobs")}>
          {running.map((job) => (
            <ListRow
              detail={`${job.status} · ${job.affectedRows} / ${job.estimatedRows}`}
              key={job.id}
              label={job.jobType}
            />
          ))}
        </ListSection>
      ) : null}

      {snapshot.deliveries.length > 0 ? (
        <ListSection header={t("admin.deliveryHealthHeader")}>
          {snapshot.deliveries.map((row) => (
            <ListRow
              key={`${row.destination}:${row.status}`}
              label={row.destination}
              detail={row.status}
              value={row.count}
            />
          ))}
        </ListSection>
      ) : null}

      {snapshot.errors.length > 0 ? (
        <ListSection footer={t("admin.errorsHelp")} header={t("ui.operations.errors")}>
          {snapshot.errors.map((entry) => (
            <ListRow
              detail={`${entry.failureId || entry.operationId} · ${formatDate(new Date(entry.lastAt))}`}
              key={`${entry.action}:${entry.code}:${entry.lastAt}`}
              label={`${entry.action} · ${entry.code}`}
              value={entry.count}
            />
          ))}
        </ListSection>
      ) : null}
    </div>
  );
}
