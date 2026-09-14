"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { ListRestart } from "lucide-react";

import { useI18n } from "@/i18n";
import type { OperationsConsole, RetryKind } from "@/hooks/use-system-console";
import { ListCustomRow, ListRow, ListSection } from "@/components/ui/list";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ProgressBar } from "@/components/ui/progress-bar";
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
import { FailureDetailSheet } from "@/components/admin/failure-detail-sheet";
import { FailureRow } from "@/components/admin/failure-row";
import {
  destinationLabel,
  errorItems,
  failureItems,
  jobLabel,
  statusLabel,
  type FailureItem,
} from "@/components/admin/system-failures";
import { timing } from "@/lib/motion-timing";

const RETRY_ALL = "all";

function percentOf(job: { estimatedRows: number; processedRows: number }) {
  if (job.estimatedRows === 0) return 0;
  return Math.min(99, Math.round((job.processedRows / job.estimatedRows) * 100));
}

/**
 * The failure surface: work that did not finish, what it said when it stopped,
 * and the controls that ask for it to be tried again.
 *
 * Every failure names its own refusal here and opens onto the whole record.
 * Retrying is one glyph per row, so a list of failures cannot be set off by a
 * stray tap, and one control above them all asks for everything at once --
 * recovering from an outage row by row spent an administrator's whole write
 * allowance before it reached the end of the list.
 */
export function SystemQueue({
  onRetry,
  onRetryAll,
  retrying,
  snapshot,
}: {
  onRetry: (kind: RetryKind, id: string) => void;
  onRetryAll: () => void;
  retrying: string;
  snapshot: Partial<OperationsConsole>;
}) {
  const { t } = useI18n();
  const [opened, setOpened] = React.useState<FailureItem | null>(null);
  const { cleanupBacklog, deliveries, errors, failedDeliveries, jobs } = snapshot;
  const failures = failureItems(snapshot, t);
  const recorded = errorItems(snapshot, t);
  // A job that finished says nothing an administrator has to act on, and a
  // column of "completed 0/0" was the loudest thing on the screen.
  const running = (jobs ?? []).filter(
    (job) => job.status === "pending" || job.status === "processing",
  );
  // "Nothing is wrong" is a claim about every reading, so it waits for them.
  const everythingRead = Boolean(jobs && failedDeliveries && cleanupBacklog && errors);

  return (
    <div className="space-y-6">
      {everythingRead ? null : <AdminListSkeleton groups={1} rows={3} />}
      <AnimatePresence initial={false}>
        {everythingRead && failures.length === 0 ? (
          <Panel key="clear">
            <ListSection header={t("admin.queueHeader")}>
              <ListRow label={t("admin.queueClear")} />
            </ListSection>
          </Panel>
        ) : null}

        {failures.length > 0 ? (
          <Panel key="failures">
            <ListSection
              header={t("admin.queueFailedHeader")}
              headerAction={
                <Button
                  disabled={Boolean(retrying)}
                  onClick={onRetryAll}
                  size="sm"
                  variant="outline"
                >
                  {retrying === RETRY_ALL ? <LoadingSpinner /> : <ListRestart aria-hidden />}
                  {t("admin.retryAll", { count: failures.length })}
                </Button>
              }
            >
              <AnimatePresence initial={false}>
                {failures.map((item) => (
                  <FailureRow
                    item={item}
                    key={item.kind + ":" + item.id}
                    onOpen={() => setOpened(item)}
                    onRetry={() => onRetry(item.kind, item.id)}
                    retrying={retrying === item.id || retrying === RETRY_ALL}
                  />
                ))}
              </AnimatePresence>
            </ListSection>
          </Panel>
        ) : null}

        {running.length > 0 ? (
          <Panel key="running">
            <ListSection header={t("ui.operations.jobs")}>
              {running.map((job) => (
                <RunningJobRow job={job} key={job.id} />
              ))}
            </ListSection>
          </Panel>
        ) : null}

        {(deliveries?.length ?? 0) > 0 ? (
          <Panel key="deliveries">
            <ListSection header={t("admin.deliveryHealthHeader")}>
              {(deliveries ?? []).map((row) => (
                <ListRow
                  detail={statusLabel(t, row.status)}
                  key={row.destination + ":" + row.status}
                  label={destinationLabel(t, row.destination)}
                  value={row.count}
                />
              ))}
            </ListSection>
          </Panel>
        ) : null}

        {recorded.length > 0 ? (
          <Panel key="errors">
            <ListSection header={t("ui.operations.errors")}>
              {recorded.map((item) => (
                <FailureRow
                  item={item}
                  key={item.id}
                  onOpen={() => setOpened(item)}
                  onRetry={() => undefined}
                  retrying={false}
                />
              ))}
            </ListSection>
          </Panel>
        ) : null}
      </AnimatePresence>

      <FailureDetailSheet
        busy={Boolean(retrying)}
        item={opened}
        onClose={() => setOpened(null)}
        onRetry={(item) => {
          onRetry(item.kind, item.id);
          setOpened(null);
        }}
      />
    </div>
  );
}

/**
 * Work that is still running, as how far through it is.
 *
 * A background job used to report only its own status and a pair of row counts
 * that were zero until it finished, so a rebuild that takes several passes was
 * indistinguishable from one that had stopped.
 */
function RunningJobRow({ job }: { job: OperationsConsole["jobs"][number] }) {
  const { t } = useI18n();
  const percent = percentOf(job);
  return (
    <ListCustomRow className="flex-col items-stretch gap-2.5">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[0.9375rem] leading-6">{jobLabel(t, job.jobType)}</p>
          <p className="text-xs leading-5 text-muted-foreground">
            {t("admin.jobProgress", {
              estimated: job.estimatedRows,
              processed: job.processedRows,
              status: statusLabel(t, job.status),
            })}
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums">{percent}%</span>
      </div>
      <ProgressBar label={t("ui.admin.backgroundProgressLabel")} percent={percent} />
    </ListCustomRow>
  );
}

/**
 * A panel of the screen, which arrives and leaves through its own height.
 *
 * Retrying everything empties three of these at once, and a panel that was
 * simply gone on the next frame read as the screen having lost its place
 * rather than as the work having been taken care of.
 */
function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      className="overflow-hidden"
      exit={{ height: 0, opacity: 0 }}
      initial={{ height: 0, opacity: 0 }}
      transition={timing("control")}
    >
      {children}
    </motion.div>
  );
}
