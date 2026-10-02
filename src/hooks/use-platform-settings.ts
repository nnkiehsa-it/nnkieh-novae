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
    useRememberedState<PlatformSettings | null>("admin-platform-settings", null);
  const { error, loading: reading, read } = useAdminReading("admin-platform-settings", "common.loadFailed");

  const load = React.useCallback(
    () => read(getCategoryManagement, (result) => setStored(result.platformSettings)),
    [read, setStored],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  const draft = useDraft<PlatformSettings>({
    estimate: (value) => estimateRetentionCleanup(value),
    save: async (value) => {
      const saved = await savePlatformSettings(value);
      const next = { imageUploads: saved.imageUploads, retention: saved.retention };
      setStored(next);
      seedImageUploadSettings(saved.imageUploads);
      markSessionBootstrapStale();
      notifyPlatformJobsChanged();
      return next;
    },
    source: stored,
    validate: validPlatformSettings,
  });

  return { draft, error, load, loading: stored === null && reading };
}
