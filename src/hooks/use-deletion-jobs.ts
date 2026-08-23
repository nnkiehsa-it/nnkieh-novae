"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { useI18n } from "@/i18n";
import {
  listDeletionJobs,
  retryDeletionJob,
  type DeletionJob,
} from "@/services/admin-console";

export function useDeletionJobs() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<DeletionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setEntries(await listDeletionJobs());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ui.adminConsole.deletionJobsLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const retry = useCallback(async (jobId: string) => {
    setRetryingId(jobId);
    try {
      await retryDeletionJob(jobId);
      setEntries((current) => current.filter((entry) => entry.id !== jobId));
      toast.success(t("ui.adminConsole.deletionJobQueued"));
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
    } finally {
      setRetryingId("");
    }
  }, [t]);

  return { entries, error, load, loading, retry, retryingId };
}
