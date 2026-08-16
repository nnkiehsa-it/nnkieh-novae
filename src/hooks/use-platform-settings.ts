"use client";

import * as React from "react";
import { toast } from "sonner";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { useCategories } from "@/hooks/use-categories";
import { useI18n } from "@/i18n";
import { getCategoryManagement, savePlatformSettings } from "@/services/categories";
import { markSessionBootstrapStale } from "@/services/session-bootstrap";
import type { PlatformSettings } from "@/types/categories";

export function usePlatformSettings() {
  const { t } = useI18n();
  const categories = useCategories();
  const feedback = useActionFeedback();
  const [settings, setSettings] = React.useState<PlatformSettings | null>(null);
  const [error, setError] = React.useState("");

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
    return [
      image.announcementMaxImages,
      image.commentMaxImages,
      image.facilityMaxImages,
      image.issueMaxImages,
      image.maxDimension,
      image.maxSourceMegabytes,
      image.maxUploadKilobytes,
      image.webpQuality,
      retention.closedFacilitiesDays,
      retention.closedIssuesDays,
    ].every((value) => Number.isFinite(value) && value > 0);
  }, [settings]);

  async function save() {
    if (!settings || !valid || feedback.busy) return;
    try {
      const saved = await feedback.run(() => savePlatformSettings(settings));
      setSettings({ imageUploads: saved.imageUploads, retention: saved.retention });
      markSessionBootstrapStale();
      await categories.refresh();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("common.saveFailed"));
    }
  }

  function updateImage<K extends keyof PlatformSettings["imageUploads"]>(key: K, value: number) {
    setSettings((current) => current ? {
      ...current,
      imageUploads: { ...current.imageUploads, [key]: value },
    } : current);
  }

  function updateRetention<K extends keyof PlatformSettings["retention"]>(key: K, value: PlatformSettings["retention"][K]) {
    setSettings((current) => current ? {
      ...current,
      retention: { ...current.retention, [key]: value },
    } : current);
  }

  return { error, feedbackState: feedback.state, load, save, saving: feedback.busy, settings, updateImage, updateRetention, valid };
}
