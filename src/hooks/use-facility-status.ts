import * as React from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { updateFacilityStatus } from "@/services/facilities";
import type { FacilityRecord, FacilityStatus } from "@/types";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export type FacilityNextStatus = Exclude<FacilityStatus, "pending">;

function nextStatus(status: FacilityStatus): FacilityNextStatus {
  return status === "pending" ? "processing" : status;
}

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
  const [status, setStatus] = React.useState<FacilityNextStatus>(nextStatus(facility.status));
  const [result, setResult] = React.useState(facility.resultContent ?? "");
  const feedback = useActionFeedback();

  React.useEffect(() => {
    if (open) {
      setStatus(nextStatus(facility.status));
      setResult(facility.resultContent ?? "");
    }
  }, [facility, open]);

  async function save() {
    if (
      (status === "completed" || status === "unable-to-handle") &&
      !result.trim()
    )
      return;
    try {
      const updated = await feedback.run(() =>
        updateFacilityStatus(
          facility.id,
          status,
          status === "completed" || status === "unable-to-handle"
            ? result.trim()
            : undefined,
        ),
      );
      onUpdated(updated);
      onClose();
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.updateFailed"));
    }
  }

  return {
    feedbackState: feedback.state,
    result,
    save,
    saving: feedback.busy,
    setResult,
    setStatus,
    status,
  };
}
