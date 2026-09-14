"use client";

import * as React from "react";

import { useI18n } from "@/i18n";
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

function isPositive(value: unknown) {
  return typeof value === "boolean" || (Number.isFinite(value) && Number(value) > 0);
}

export function usePlatformSettings() {
  const { t } = useI18n();
  const { remember: setStored, value: stored } =
    useRememberedState<PlatformSettings | null>("admin-platform-settings", null);
  const [error, setError] = React.useState("");
  const [reading, setReading] = React.useState(false);

  const load = React.useCallback(async () => {
    setReading(true);
    setError("");
    try {
      setStored((await getCategoryManagement()).platformSettings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.loadFailed"));
    } finally {
      setReading(false);
    }
  }, [setStored, t]);

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
    validate: (value) =>
      Object.values(value.retention).every(isPositive)
      && Object.values(value.imageUploads).every(isPositive),
  });

  return { draft, error, load, loading: stored === null && reading };
}
