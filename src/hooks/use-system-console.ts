"use client";

import * as React from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useRememberedState } from "@/hooks/use-remembered-state";
import { useForegroundPoll } from "@/hooks/use-foreground-poll";
import { useAdminReading } from "@/hooks/use-admin-reading";
import {
  clearOperationalErrors,
  clearScheduledWork,
  fetchOperationsConsole,
  fetchOperationsQueue,
  queueNotionArchiveRebuild,
  retryOperationalWork,
  type OperationsConsole,
} from "@/services/operations-console";

export type { OperationsConsole } from "@/services/operations-console";
export type RetryKind = "cleanup" | "delivery" | "job";

const isRunning = (job: { status: string }) =>
  job.status === "pending" || job.status === "processing";

interface SystemReading {
  page: number;
  snapshot: Partial<OperationsConsole> | null;
}

type Mutation =
  | { type: "retry"; id: string }
  | { type: "clear"; kind: "errors" | "schedules" }
  | { type: "rebuild" };

/** Reads and writes share a fence, so old polls cannot undo an administrator's action. */
export function useSystemConsole() {
  const { t } = useI18n();
  const { remember, value } = useRememberedState<SystemReading>("admin-system", {
    page: 0,
    snapshot: null,
  });
  const { capture, error, invalidate, isActive, loading, read: readRequest } = useAdminReading("admin-system", "common.loadFailed");
  const [mutation, setMutation] = React.useState<Mutation | null>(null);
  const [pollError, setPollError] = React.useState("");
  const mutationOwner = React.useRef<object | null>(null);
  const latestPage = React.useRef(value.page);
  React.useEffect(() => { latestPage.current = value.page; }, [value.page]);

  React.useEffect(() => {
    mutationOwner.current = null;
    setMutation(null);
    setPollError("");
  }, [isActive]);

  const read = React.useCallback(
    (nextPage: number, queueOnly = false) => readRequest(
      (active) => {
        setPollError("");
        return queueOnly
          ? fetchOperationsQueue({ page: nextPage, queueOnly: true })
          : fetchOperationsConsole({ page: nextPage, systemOnly: true }, {
            onPanel: (panel) => {
              if (active()) remember((current) => ({ ...current, page: nextPage, snapshot: { ...current.snapshot, ...panel } }));
            },
          });
      },
      (snapshot) => remember((current) => ({
        page: nextPage,
        snapshot: queueOnly ? { ...current.snapshot, ...snapshot } : snapshot,
      })),
    ),
    [readRequest, remember],
  );

  const load = React.useCallback(
    (nextPage = 0) => mutationOwner.current ? Promise.resolve() : read(nextPage),
    [read],
  );

  React.useEffect(() => {
    // A previous visit may have cached only the first streamed queue panel.
    // Reopen with a full read so capacity cannot remain permanently unknown.
    void load(latestPage.current);
  }, [load]);

  const working = (value.snapshot?.jobs ?? []).some(isRunning)
    || (value.snapshot?.deliveries ?? []).some((delivery) => isRunning(delivery) && delivery.count > 0);
  useForegroundPoll(async () => {
    if (mutationOwner.current) return;
    const current = capture();
    try {
      const snapshot = await fetchOperationsQueue({ page: value.page, queueOnly: true });
      if (!current() || mutationOwner.current) return;
      setPollError("");
      remember((reading) => reading.page !== value.page ? reading : {
        ...reading,
        snapshot: { ...reading.snapshot, ...snapshot },
      });
    } catch (caught) {
      if (current() && !mutationOwner.current) setPollError(caught instanceof Error ? caught.message : t("common.loadFailed"));
      throw caught;
    }
  }, working && !loading && !mutation, { initialDelayMs: 4000 });

  const mutate = React.useCallback(async <T,>(
    next: Mutation,
    work: () => Promise<T>,
    completed: (result: T) => void,
    nextPage?: number,
  ) => {
    if (mutationOwner.current || !isActive()) return;
    const owner = {};
    mutationOwner.current = owner;
    const current = () => isActive() && mutationOwner.current === owner;
    invalidate();
    setMutation(next);
    try {
      const result = await work();
      if (!current()) return;
      completed(result);
      // Refresh canonical queue rows, counts and pagination together. Capacity
      // stays on screen without rerunning its expensive diagnostic queries.
      await read(nextPage ?? latestPage.current, true);
    } catch (caught) {
      if (current()) toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
    } finally {
      if (current()) setMutation(null);
      if (mutationOwner.current === owner) mutationOwner.current = null;
    }
  }, [invalidate, isActive, read, t]);

  const retry = (kind: RetryKind, id: string) => mutate(
    { type: "retry", id },
    () => retryOperationalWork({ id, kind }),
    () => toast.success(t("admin.retryQueued")),
  );

  const retryAll = () => mutate(
    { type: "retry", id: "all" },
    () => retryOperationalWork({ kind: "all" }),
    (result) => toast.success(t("admin.retryAllQueued", { count: result.retried ?? 0 })),
  );

  const clearErrors = () => mutate(
    { type: "clear", kind: "errors" },
    () => clearOperationalErrors({}),
    (result) => toast.success(t("admin.clearErrorsDone", { count: result.cleared })),
  );

  const clearSchedules = () => mutate(
    { type: "clear", kind: "schedules" },
    () => clearScheduledWork({}),
    (result) => toast.success(t("admin.clearSchedulesDone", { count: result.cleared })),
  );

  const rebuildNotion = () => mutate(
    { type: "rebuild" },
    () => queueNotionArchiveRebuild({}),
    (result) => {
      // Replace superseded jobs immediately while the canonical queue is read.
      remember((current) => ({
        page: 0,
        snapshot: {
          ...current.snapshot,
          jobs: [{
            affectedRows: 0, attemptCount: 0, errorDetail: null, estimatedRows: 0,
            id: result.jobId, jobType: "notion_reconcile", lastAttemptId: null,
            processedRows: 0, status: "pending", updatedAt: new Date().toISOString(),
          }],
        },
      }));
      const { cleanup, deliveries, jobs, mappings } = result.cleared;
      toast.success(t("ui.operations.notionRebuildQueued", { cleared: cleanup + deliveries + jobs + mappings }));
    },
    0,
  );

  return {
    busy: mutation !== null,
    clearErrors,
    clearSchedules,
    clearing: mutation?.type === "clear" ? mutation.kind : "" as const,
    error: error || pollError,
    load,
    loading,
    notionJob: (value.snapshot?.jobs ?? []).find(
      (job) => job.jobType === "notion_reconcile" && isRunning(job),
    ) ?? null,
    page: value.page,
    rebuildNotion,
    rebuildingNotion: mutation?.type === "rebuild",
    retry,
    retryAll,
    retrying: mutation?.type === "retry" ? mutation.id : "",
    snapshot: value.snapshot,
  };
}
