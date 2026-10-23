import * as React from "react";
import { ListChecks } from "@phosphor-icons/react/ssr";
import { AnimatePresence } from "motion/react";
import type { OperationsConsole, RetryKind } from "@/hooks/use-system-console";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";
import { ListGroup, ListRow } from "@/ui/list";
import { LoadingList } from "@/ui/page";
import { JobProgressRow, jobPercent } from "../shared/job-progress-row";
import { Reveal } from "../shared/reveal";
import { ClearActions } from "./clear-actions";
import { FailureDetailSheet } from "./failure-detail-sheet";
import { FailureRow } from "./failure-row";
import { destinationLabel, errorItems, failureItems, jobLabel, statusLabel, type FailureItem } from "./failures";

const RETRY_ALL = "all";

/**
 * The failure surface: work that did not finish, what it said when it stopped,
 * and the controls that ask for it to be tried again. Retrying is one glyph per
 * row so a stray tap cannot queue it, and one control above them all asks for
 * everything at once, since recovering from an outage row by row would spend an
 * administrator's whole write allowance.
 */
export function SystemQueue({ busy, clearing, onClearErrors, onClearSchedules, onRetry, onRetryAll, retrying, snapshot }: {
  busy: boolean;
  clearing: "errors" | "schedules" | "";
  onClearErrors: () => void;
  onClearSchedules: () => void;
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
  // A job that finished says nothing an administrator has to act on.
  const running = (jobs ?? []).filter((job) => job.status === "pending" || job.status === "processing");
  // "Nothing is wrong" is a claim about every reading, so it waits for all of them.
  const everythingRead = Boolean(jobs && failedDeliveries && cleanupBacklog && errors);

  return (
    <div className="grid gap-6">
      {everythingRead ? null : <LoadingList label={t("common.loading")} rows={3} />}
      <AnimatePresence initial={false}>
        {everythingRead && failures.length === 0 ? (
          <Reveal key="clear">
            <ListGroup title={t("admin.queueHeader")}>
              <ListRow icon={<ListChecks />} label={t("admin.queueClear")} />
            </ListGroup>
          </Reveal>
        ) : null}
        {failures.length > 0 ? (
          <Reveal key="failures">
            <ListGroup
              action={
                <Button disabled={busy} onClick={onRetryAll} size="sm" status={retrying === RETRY_ALL ? "loading" : "idle"}>
                  {t("admin.retryAll")}
                </Button>
              }
              title={t("admin.queueFailedHeader")}
            >
              {failures.map((item) => (
                <FailureRow
                  disabled={busy}
                  item={item}
                  key={`${item.kind}:${item.id}`}
                  onOpen={() => setOpened(item)}
                  onRetry={() => onRetry(item.kind, item.id)}
                  retrying={retrying === item.id || retrying === RETRY_ALL}
                />
              ))}
            </ListGroup>
          </Reveal>
        ) : null}
        {running.length > 0 ? (
          <Reveal key="running">
            <ListGroup title={t("ui.operations.jobs")}>
              {running.map((job) => (
                <JobProgressRow
                  detail={t("admin.jobProgress", { estimated: job.estimatedRows, processed: job.processedRows, status: statusLabel(t, job.status) })}
                  key={job.id}
                  label={jobLabel(t, job.jobType)}
                  percent={jobPercent(job)}
                />
              ))}
            </ListGroup>
          </Reveal>
        ) : null}
        {(deliveries?.length ?? 0) > 0 ? (
          <Reveal key="deliveries">
            <ListGroup title={t("admin.deliveryHealthHeader")}>
              {(deliveries ?? []).map((row) => (
                <ListRow
                  detail={statusLabel(t, row.status)}
                  key={`${row.destination}:${row.status}`}
                  label={destinationLabel(t, row.destination)}
                  value={row.count}
                />
              ))}
            </ListGroup>
          </Reveal>
        ) : null}
        {recorded.length > 0 ? (
          <Reveal key="errors">
            <ListGroup title={t("ui.operations.errors")}>
              {recorded.map((item) => (
                <FailureRow item={item} key={item.id} onOpen={() => setOpened(item)} />
              ))}
            </ListGroup>
          </Reveal>
        ) : null}
        {everythingRead ? (
          <Reveal key="clear-actions">
            <ClearActions busy={busy} clearing={clearing} onClearErrors={onClearErrors} onClearSchedules={onClearSchedules} />
          </Reveal>
        ) : null}
      </AnimatePresence>
      <FailureDetailSheet
        busy={busy}
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
