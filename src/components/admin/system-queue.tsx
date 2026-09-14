"use client";

import { useI18n } from "@/i18n";
import type {
  DeletionJob,
  OperationsConsole,
  RetryKind,
} from "@/hooks/use-system-console";
import { ListActionRow, ListRow, ListSection } from "@/components/ui/list";
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
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
  snapshot: Partial<OperationsConsole>;
}) {
  const { t } = useI18n();
  const { cleanupBacklog, deliveries, errors, failedDeliveries, jobs } = snapshot;
  const stuck = jobs?.filter((job) => job.status === "failed") ?? [];
  const running = jobs?.filter((job) => job.status !== "failed") ?? [];
  // "Nothing is wrong" is a claim about every reading, so it waits for them.
  const everythingRead = Boolean(jobs && failedDeliveries && cleanupBacklog && errors);
  const nothingWrong =
    everythingRead
    && stuck.length === 0
    && failedDeliveries?.length === 0
    && cleanupBacklog?.length === 0
    && mediaFailures.length === 0
    && errors?.length === 0;

  return (
    <div className="space-y-6">
      {jobs && failedDeliveries && cleanupBacklog && errors ? null : (
        <AdminListSkeleton groups={1} rows={3} />
      )}
      {nothingWrong ? (
        <ListSection header={t("admin.queueHeader")}>
          <ListRow label={t("admin.queueClear")} />
        </ListSection>
      ) : null}

      {stuck.length > 0 || (cleanupBacklog?.length ?? 0) > 0 || mediaFailures.length > 0 ? (
        <ListSection header={t("admin.queueFailedHeader")}>
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
          {(cleanupBacklog ?? []).map((entry) => (
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

      {(failedDeliveries?.length ?? 0) > 0 ? (
        <ListSection header={t("ui.operations.deliveries")}>
          {(failedDeliveries ?? []).map((entry) => (
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

      {(deliveries?.length ?? 0) > 0 ? (
        <ListSection header={t("admin.deliveryHealthHeader")}>
          {(deliveries ?? []).map((row) => (
            <ListRow
              key={`${row.destination}:${row.status}`}
              label={row.destination}
              detail={row.status}
              value={row.count}
            />
          ))}
        </ListSection>
      ) : null}

      {(errors?.length ?? 0) > 0 ? (
        <ListSection header={t("ui.operations.errors")}>
          {(errors ?? []).map((entry) => (
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
