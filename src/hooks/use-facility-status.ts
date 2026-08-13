"use client";

import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { updateFacilityStatus } from "@/services/facilities";
import type { FacilityRecord, FacilityStatus } from "@/types";

export function useFacilityStatus({
  facility,
  onClose,
  onUpdated,
  open,
}: {
  facility: FacilityRecord;
  onClose: () => void;
  onUpdated: (facility: FacilityRecord) => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const [status, setStatus] = React.useState<FacilityStatus>(facility.status);
  const [result, setResult] = React.useState(facility.result_content ?? "");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setStatus(facility.status);
      setResult(facility.result_content ?? "");
    }
  }, [facility, open]);

  async function save() {
    if (
      (status === "completed" || status === "unable-to-handle") &&
      !result.trim()
    )
      return;
    setSaving(true);
    try {
      const updated = await updateFacilityStatus(
        facility.id,
        status,
        status === "completed" || status === "unable-to-handle"
          ? result.trim()
          : undefined,
      );
      onUpdated(updated);
      toast.success(t("ui.facility.statusUpdated"));
      onClose();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.updateFailed"));
    } finally {
      setSaving(false);
    }
  }

  return { result, save, saving, setResult, setStatus, status };
}
