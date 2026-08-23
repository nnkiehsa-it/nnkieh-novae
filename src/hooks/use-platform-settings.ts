"use client";

import * as React from "react";
import { toast } from "sonner";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { seedImageUploadSettings } from "@/hooks/use-categories";
import { useI18n } from "@/i18n";
import {
  estimateRetentionCleanup,
  getCategoryManagement,
  savePlatformSettings,
} from "@/services/categories";
import { markSessionBootstrapStale } from "@/services/session-bootstrap";
import { notifyPlatformJobsChanged } from "@/lib/platform-job-events";
import type { PlatformSettings } from "@/types/categories";

export function usePlatformSettings() {
  const { t } = useI18n();
  const feedback = useActionFeedback();
  const [settings, setSettings] = React.useState<PlatformSettings | null>(null);
  const [error, setError] = React.useState("");
  const [pendingSettings, setPendingSettings] = React.useState<PlatformSettings | null>(null);
  const [impactDetails, setImpactDetails] = React.useState<Record<string, number>>({});
  const [totalEstimatedRows, setTotalEstimatedRows] = React.useState(0);

  const load = React.useCallback(async () => {
    setError("");
    try {
      const management = await getCategoryManagement();
      setSettings(management.platformSettings);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("common.loadFailed"));
    }
  }, [t]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const valid = React.useMemo(() => {
    if (!settings) return false;
    const image = settings.imageUploads;
    const retention = settings.retention;
    return Object.values(retention).every((value) => typeof value === "boolean" || (Number.isFinite(value) && value > 0)) && [
      image.announcementMaxImages,
      image.commentMaxImages,
      image.facilityMaxImages,
      image.issueMaxImages,
      image.maxDimension,
      image.maxUploadKilobytes,
      image.webpQuality,
    ].every((value) => Number.isFinite(value) && value > 0);
  }, [settings]);

  async function persist(nextSettings: PlatformSettings) {
    try {
      const saved = await feedback.run(() => savePlatformSettings(nextSettings));
      setSettings({ imageUploads: saved.imageUploads, retention: saved.retention });
      seedImageUploadSettings(saved.imageUploads);
      markSessionBootstrapStale();
      notifyPlatformJobsChanged();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("common.saveFailed"));
    }
  }

  async function save() {
    if (!settings || !valid || feedback.busy) return;
    try {
      const impact = await estimateRetentionCleanup(settings);
      if (impact.totalEstimatedRows > 0) {
        setPendingSettings(settings);
        setImpactDetails(impact.details);
        setTotalEstimatedRows(impact.totalEstimatedRows);
        return;
      }
      await persist(settings);
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("common.saveFailed"));
    }
  }

  async function confirmSave() {
    const nextSettings = pendingSettings;
    setPendingSettings(null);
    if (nextSettings) await persist(nextSettings);
  }

  function updateImage<K extends keyof PlatformSettings["imageUploads"]>(key: K, value: number) {
    setSettings((current) => current ? {
      ...current,
      imageUploads: { ...current.imageUploads, [key]: value },
    } : current);
  }

  function updateRetention(key: keyof PlatformSettings["retention"], value: boolean | number) {
    setSettings((current) => current ? {
      ...current,
      retention: { ...current.retention, [key]: value } as PlatformSettings["retention"],
    } : current);
  }

  return {
    cancelSave: () => setPendingSettings(null),
    confirmSave,
    error,
    feedbackState: feedback.state,
    impactDetails,
    impactOpen: pendingSettings !== null,
    load,
    save,
    saving: feedback.busy,
    settings,
    totalEstimatedRows,
    updateImage,
    updateRetention,
    valid,
  };
}
