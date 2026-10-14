"use client";

import { useI18n } from "@/i18n";
import type { FacilityRecord } from "@/types";
import { useFacilityStatus, type FacilityNextStatus } from "@/hooks/use-facility-status";
import { DecisionSheet, type DecisionOption } from "@/ui/decision";

/** A report moves forward only; nothing sends one back to pending. */
const OPTIONS: ReadonlyArray<readonly [FacilityNextStatus, string]> = [
  ["processing", "ui.status.processing"],
  ["completed", "ui.status.completed"],
  ["unable-to-handle", "ui.status.unable"],
];

/** Moves a facility report along, with a result once it is closed. */
export function FacilityStatusSheet({ facility, onOpenChange, onUpdated, open }: {
  facility: FacilityRecord;
  onOpenChange: (open: boolean) => void;
  onUpdated: (facility: FacilityRecord) => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const state = useFacilityStatus({ facility, onClose: () => onOpenChange(false), onUpdated, open });
  const options: DecisionOption[] = OPTIONS.map(([value, labelKey]) => ({
    label: t(labelKey),
    tone: value === "unable-to-handle" ? "danger" : "default",
    value,
  }));
  const concluding = state.status === "completed" || state.status === "unable-to-handle";
  return (
    <DecisionSheet
      note={concluding
        ? { label: t("ui.common.result"), onChange: state.setResult, placeholder: t("ui.facility.resultPlaceholder"), required: true, value: state.result }
        : undefined}
      onOpenChange={onOpenChange}
      onSubmit={() => void state.save()}
      onValueChange={(value) => state.setStatus(value as FacilityNextStatus)}
      open={open}
      options={options}
      sheetTitle={t("ui.facility.statusDialogTitle")}
      status={state.saving ? (state.feedbackState === "success" ? "success" : "loading") : "idle"}
      submitLabel={t("ui.common.submit")}
      title={t("ui.common.status")}
      value={state.status}
    />
  );
}
