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

  const load = React.useCallback(
    async (nextPage = 0) => {
      setLoading(true);
      setError("");
      try {
        const console_ = await fetchOperationsConsole({ page: nextPage }, {
          onPanel: (panel) => remember((current) => ({
            ...current,
            page: nextPage,
            snapshot: { ...current.snapshot, ...panel },
          })),
        });
        remember({ page: nextPage, snapshot: console_ });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        setLoading(false);
      }
    },
    [remember],
  );

  React.useEffect(() => {
    if (cold) void load();
  }, [cold, load]);

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

  const rebuildNotion = React.useCallback(async () => {
    setRebuildingNotion(true);
    try {
      const result = await queueNotionArchiveRebuild({});
      toast.success(t(result.alreadyQueued
        ? "ui.operations.notionRebuildAlreadyQueued"
        : "ui.operations.notionRebuildQueued"));
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
    page: value.page,
    rebuildNotion,
    rebuildingNotion,
    retry,
    retrying,
    snapshot: value.snapshot,
  };
}
