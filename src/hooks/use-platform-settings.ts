"use client";

import * as React from "react";

import { useAdminReading } from "@/hooks/use-admin-reading";
import { seedImageUploadSettings } from "@/hooks/use-categories";
import { useDraft } from "@/hooks/use-draft";
import { useRememberedState } from "@/hooks/use-remembered-state";
import {
  estimateRetentionCleanup,
  getCategoryManagement,
  savePlatformSettings,
} from "@/services/categories";
import { markSessionBootstrapStale } from "@/services/session-bootstrap";
import { notifyPlatformJobsChanged } from "@/lib/platform-job-events";
import type { PlatformSettings } from "@/types/categories";
import { validPlatformSettings } from "@/lib/admin-setting-presets";

export function usePlatformSettings() {
  const { remember: setStored, value: stored } =
    useRememberedState<(PlatformSettings & { revision: string }) | null>("admin-platform-settings", null);
  const { error, invalidate, isActive, loading: reading, read } = useAdminReading("admin-platform-settings", "common.loadFailed");

  const load = React.useCallback(
    () => read(getCategoryManagement, (result) => setStored({ ...result.platformSettings, revision: result.platformRevision })),
    [read, setStored],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const draft = useDraft<PlatformSettings & { revision: string }>({
    estimate: (value, baseline) => estimateRetentionCleanup(value, baseline.revision),
    save: async (value, _reason, baseline) => {
      invalidate();
      const saved = await savePlatformSettings(value, baseline.revision);
      const next = { imageUploads: saved.imageUploads, retention: saved.retention, revision: saved.revision };
      if (!isActive()) return next;
      setStored(next);
      seedImageUploadSettings(saved.imageUploads);
      markSessionBootstrapStale();
      if (saved.jobId !== null) notifyPlatformJobsChanged();
      return next;
    },
    source: stored,
    validate: validPlatformSettings,
  });

  return { draft, error, load, loading: stored === null && reading };
}
