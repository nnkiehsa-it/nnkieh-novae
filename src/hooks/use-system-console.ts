"use client";

import * as React from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import { useRememberedState } from "@/hooks/use-remembered-state";
import {
  fetchOperationsConsole,
  queueNotionArchiveRebuild,
  retryOperationalWork,
  type OperationsConsole,
} from "@/services/operations-console";

export type { OperationsConsole } from "@/services/operations-console";

export type RetryKind = "cleanup" | "delivery" | "job";

/**
 * How often a screen with work in flight asks again.
 *
 * The administration surfaces do not refresh themselves, with one exception:
 * progress on work this administrator just queued is feedback on their own
 * action, and a rebuild that takes many passes was otherwise frozen at whatever
 * the screen happened to read when they pressed the button.
 */
const PROGRESS_POLL_MS = 4000;

const isRunning = (job: { status: string }) =>
  job.status === "pending" || job.status === "processing";

interface SystemReading {
  page: number;
  snapshot: Partial<OperationsConsole> | null;
}

/**
 * Everything the platform is currently failing to finish, in one place.
 *
 * Retries used to live in three unrelated screens, each with its own idea of
 * what happens afterwards. Here a retry removes the row it belongs to and
 * leaves the rest of the screen alone, because re-reading the whole console to
 * learn that one entry is gone is how the expanded rows and the scroll position
 * used to disappear. The reading itself is kept, so returning to the screen
 * shows what it last said instead of asking again. The ten readings behind it
 * arrive one at a time, and each panel fills in as its own lands.
 */
export function useSystemConsole() {
  const { t } = useI18n();
  const { cold, remember, value } = useRememberedState<SystemReading>("admin-system", {
    page: 0,
    snapshot: null,
  });
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [retrying, setRetrying] = React.useState("");
  const [rebuildingNotion, setRebuildingNotion] = React.useState(false);

  const read = React.useCallback(
    async (nextPage: number) => {
      const console_ = await fetchOperationsConsole({ page: nextPage }, {
        onPanel: (panel) => remember((current) => ({
          ...current,
          page: nextPage,
          snapshot: { ...current.snapshot, ...panel },
        })),
      });
      remember({ page: nextPage, snapshot: console_ });
    },
    [remember],
  );

  const load = React.useCallback(
    async (nextPage = 0) => {
      setLoading(true);
      setError("");
      try {
        await read(nextPage);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setLoading(false);
      }
    },
    [read],
  );

  React.useEffect(() => {
    if (cold) void load();
  }, [cold, load]);

  const working = (value.snapshot?.jobs ?? []).some(isRunning);
  React.useEffect(() => {
    if (!working) return undefined;
    // Silently, and without the spinner: this is the screen keeping itself
    // honest, not the reader asking it a question.
    const timer = window.setInterval(() => {
      void read(value.page).catch(() => undefined);
    }, PROGRESS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [read, value.page, working]);

  const retry = React.useCallback(
    async (kind: RetryKind, id: string) => {
      setRetrying(id);
      try {
        await retryOperationalWork({ id, kind });
        remember((current) => ({
          ...current,
          snapshot: current.snapshot && {
            ...current.snapshot,
            cleanupBacklog: current.snapshot.cleanupBacklog?.filter(
              (entry) => entry.jobId !== id,
            ),
            failedDeliveries: current.snapshot.failedDeliveries?.filter(
              (entry) => entry.id !== id,
            ),
            jobs: current.snapshot.jobs?.filter((entry) => entry.id !== id),
          },
        }));
        toast.success(t("admin.retryQueued"));
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      } finally {
        setRetrying("");
      }
    },
    [remember, t],
  );

  /**
   * Everything that failed, asked for again in one write.
   *
   * Row by row this was one admin write per failure, and an outage that left a
   * page of them behind ran the administrator into their own rate limit before
   * the list was clear. The whole reading is taken again afterwards, because
   * this changes every panel on the screen rather than one row of one.
   */
  const retryAll = React.useCallback(async () => {
    setRetrying("all");
    try {
      const result = await retryOperationalWork({ kind: "all" });
      toast.success(t("admin.retryAllQueued", { count: result.retried ?? 0 }));
      await load(value.page);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
    } finally {
      setRetrying("");
    }
  }, [load, t, value.page]);

  const rebuildNotion = React.useCallback(async () => {
    setRebuildingNotion(true);
    try {
      const result = await queueNotionArchiveRebuild({});
      const cleared = result.cleared;
      toast.success(result.alreadyQueued || !cleared
        ? t("ui.operations.notionRebuildAlreadyQueued")
        : t("ui.operations.notionRebuildQueued", {
          cleared: cleared.deliveries + cleared.jobs + cleared.mappings,
        }));
      await load(0);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.operations.notionRebuildFailed"));
    } finally {
      setRebuildingNotion(false);
    }
  }, [load, t]);

  return {
    error,
    load,
    loading,
    notionJob: (value.snapshot?.jobs ?? []).find(
      (job) => job.jobType === "notion_reconcile" && isRunning(job),
    ) ?? null,
    page: value.page,
    rebuildNotion,
    rebuildingNotion,
    retry,
    retryAll,
    retrying,
    snapshot: value.snapshot,
  };
}
