"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import type { FacilityRecord, FacilityStatus } from "@/types";
import { useFacilityStatus } from "@/hooks/use-facility-status";
import { DecisionSheet, type DecisionOption } from "@/components/ui/decision-sheet";

const OPTION_KEYS: ReadonlyArray<[FacilityStatus, string]> = [
  ["pending", "ui.status.pending"],
  ["processing", "ui.status.processing"],
  ["completed", "ui.status.completed"],
  ["unable-to-handle", "ui.status.unable"],
];

export function FacilityStatusDialog({
  facility,
  onOpenChange,
  onUpdated,
  open,
}: {
  facility: FacilityRecord;
  onOpenChange: (open: boolean) => void;
  onUpdated: (facility: FacilityRecord) => void;
  open: boolean;
}) {
  useLocaleSubscription();
  const state = useFacilityStatus({
    facility,
    onClose: () => onOpenChange(false),
    onUpdated,
    open,
  });

  const options: DecisionOption[] = OPTION_KEYS.map(([value, labelKey]) => ({
    label: translate(labelKey),
    value,
  }));

  const concluding = state.status === "completed" || state.status === "unable-to-handle";

  return (
    <DecisionSheet
      busy={state.saving}
      feedback={state.feedbackState}
      note={
        concluding
          ? {
              label: translate("ui.common.result"),
              onChange: state.setResult,
              placeholder: translate("ui.facility.resultPlaceholder"),
              required: true,
              value: state.result,
            }
          : undefined
      }
      onOpenChange={onOpenChange}
      onSubmit={() => void state.save()}
      onValueChange={(value) => state.setStatus(value as FacilityStatus)}
      open={open}
      options={options}
      sectionHeader={translate("ui.common.status")}
      submitLabel={translate("ui.common.submit")}
      title={translate("ui.facility.statusDialogTitle")}
      value={state.status}
    />
  );
}
