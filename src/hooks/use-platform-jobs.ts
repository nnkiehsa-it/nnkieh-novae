"use client";

import { useCallback, useEffect, useState } from "react";

import { listPlatformJobs, type PlatformJob } from "@/services/categories";
import { useI18n } from "@/i18n";
import { subscribePlatformJobsChanged } from "@/lib/platform-job-events";

const ACTIVE_STATUSES = new Set<PlatformJob["status"]>(["pending", "processing"]);

export function usePlatformJobs() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<PlatformJob[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setEntries((await listPlatformJobs()).entries);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("ui.admin.backgroundJobsLoadFailed"));
    }
  }, [t]);

  useEffect(() => {
    void load();
    return subscribePlatformJobsChanged(() => void load());
  }, [load]);

  const active = entries.some((entry) => ACTIVE_STATUSES.has(entry.status));
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => void load(), 1_000);
    return () => window.clearInterval(timer);
  }, [active, load]);

  return { active, entries, error, load };
}
