"use client";

import { useI18n } from "@/i18n";
import type { OperationsConsole, RetryKind } from "@/hooks/use-system-console";
import { ListActionRow, ListRow, ListSection } from "@/components/ui/list";
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
import { formatDate } from "@/lib/format";

const JOB_LABELS: Record<string, string> = {
  category_policy: "ui.operations.job.categoryPolicy",
  deletion: "ui.operations.job.deletion",
  notion_reconcile: "ui.operations.job.notionRebuild",
  retention_cleanup: "ui.operations.job.retentionCleanup",
};
const STATUS_LABELS: Record<string, string> = {
  completed: "ui.operations.status.completed",
  failed: "ui.operations.status.failed",
  pending: "ui.operations.status.pending",
  processing: "ui.operations.status.processing",
  superseded: "ui.operations.status.superseded",
};
const DESTINATION_LABELS: Record<string, string> = {
  in_app: "ui.operations.destination.inApp",
  notion: "ui.operations.destination.notion",
  push: "ui.operations.destination.push",
  realtime: "ui.operations.destination.realtime",
};

/**
 * The failure surface: work that did not finish, and the one control that asks
 * for it to be tried again.
 */
export function SystemQueue({
  onRetry,
  retrying,
  snapshot,
}: {
  onRetry: (kind: RetryKind, id: string) => void;
  retrying: string;
  snapshot: Partial<OperationsConsole>;
}) {
  const { t } = useI18n();
  const jobLabel = (value: string) => JOB_LABELS[value] ? t(JOB_LABELS[value]) : value;
  const statusLabel = (value: string) => STATUS_LABELS[value] ? t(STATUS_LABELS[value]) : value;
  const destinationLabel = (value: string) => DESTINATION_LABELS[value] ? t(DESTINATION_LABELS[value]) : value;
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

      {stuck.length > 0 || (cleanupBacklog?.length ?? 0) > 0 ? (
        <ListSection header={t("admin.queueFailedHeader")}>
          {stuck.map((job) => (
            <ListActionRow
              busy={retrying === job.id}
              detail={t("admin.jobAttempts", { attempts: job.attemptCount, id: job.id })}
              key={job.id}
              label={jobLabel(job.jobType)}
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
        </ListSection>
      ) : null}

      {(failedDeliveries?.length ?? 0) > 0 ? (
        <ListSection header={t("ui.operations.deliveries")}>
          {(failedDeliveries ?? []).map((entry) => (
            <ListActionRow
              busy={retrying === entry.id}
              detail={`${entry.eventType} · ${entry.operationId}`}
              key={entry.id}
              label={destinationLabel(entry.destination)}
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
              detail={`${statusLabel(job.status)} · ${job.affectedRows} / ${job.estimatedRows}`}
              key={job.id}
              label={jobLabel(job.jobType)}
            />
          ))}
        </ListSection>
      ) : null}

      {(deliveries?.length ?? 0) > 0 ? (
        <ListSection header={t("admin.deliveryHealthHeader")}>
          {(deliveries ?? []).map((row) => (
            <ListRow
              key={`${row.destination}:${row.status}`}
              label={destinationLabel(row.destination)}
              detail={statusLabel(row.status)}
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
