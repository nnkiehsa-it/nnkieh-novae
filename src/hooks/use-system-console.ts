"use client";

import * as React from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import {
  listDeletionJobs,
  retryDeletionJob,
  type DeletionJob,
} from "@/services/admin-console";
import {
  fetchOperationsConsole,
  retryOperationalWork,
  type OperationsConsole,
} from "@/services/operations-console";

export type { DeletionJob } from "@/services/admin-console";
export type { OperationsConsole } from "@/services/operations-console";

export type RetryKind = "cleanup" | "delivery" | "job" | "media";

/**
 * Everything the platform is currently failing to finish, in one place.
 *
 * Retries used to live in three unrelated screens, each with its own idea of
 * what happens afterwards. Here a retry removes the row it belongs to and
 * leaves the rest of the screen alone, because re-reading the whole console to
 * learn that one entry is gone is how the expanded rows and the scroll position
 * used to disappear.
 */
export function useSystemConsole() {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = React.useState<OperationsConsole | null>(null);
  const [mediaFailures, setMediaFailures] = React.useState<DeletionJob[]>([]);
  const [page, setPage] = React.useState(0);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [retrying, setRetrying] = React.useState("");

  const load = React.useCallback(async (nextPage = 0) => {
    setLoading(true);
    setError("");
    try {
      const [console_, media] = await Promise.all([
        fetchOperationsConsole({ page: nextPage }),
        listDeletionJobs(),
      ]);
      setSnapshot(console_);
      setMediaFailures(media);
      setPage(nextPage);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const retry = React.useCallback(
    async (kind: RetryKind, id: string) => {
      setRetrying(id);
      try {
        if (kind === "media") {
          await retryDeletionJob(id);
          setMediaFailures((current) => current.filter((entry) => entry.id !== id));
        } else {
          await retryOperationalWork({ id, kind });
          setSnapshot((current) =>
            current
              ? {
                  ...current,
                  cleanupBacklog: current.cleanupBacklog.filter((entry) => entry.jobId !== id),
                  failedDeliveries: current.failedDeliveries.filter((entry) => entry.id !== id),
                  jobs: current.jobs.filter((entry) => entry.id !== id),
                }
              : current,
          );
        }
        toast.success(t("admin.retryQueued"));
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      } finally {
        setRetrying("");
      }
    },
    [t],
  );

  return { error, load, loading, mediaFailures, page, retry, retrying, snapshot };
}
