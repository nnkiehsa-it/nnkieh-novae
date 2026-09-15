"use client";

import { ListPicker } from "@/components/ui/choice-select";
import { ListInputRow, ListNoteRow, ListNumberRow } from "@/components/ui/list-controls";
import { ACCOUNT_ACCESS_DURATIONS, ACCOUNT_ACCESS_DURATION_KEYS, ACCOUNT_ACCESS_PRESETS, ACCOUNT_ACCESS_PRESET_KEYS } from "@/constants/account-access";
import type { AccountAccessDuration, AccountAccessPreset } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";

export interface AccountAccessRuleDraft {
  duration: AccountAccessDuration;
  durationHours: number;
  message: string;
  preset: AccountAccessPreset;
}

export function AccountAccessRuleFields({
  draft,
  onChange,
  onTargetChange,
  targetDisabled = false,
  targetValue,
}: {
  draft: AccountAccessRuleDraft;
  onChange: (next: Partial<AccountAccessRuleDraft>) => void;
  onTargetChange?: (value: string) => void;
  targetDisabled?: boolean;
  targetValue?: string;
}) {
  const { t } = useI18n();
  return <>
    {onTargetChange !== undefined ? <ListInputRow disabled={targetDisabled} label={t("ui.accountAccess.prefixLabel")} maxLength={64} onChange={onTargetChange} placeholder="hs" value={targetValue ?? ""} /> : null}
    <ListPicker label={t("ui.accountAccess.presetLabel")} onChange={(preset) => onChange({ preset: preset as AccountAccessPreset })} options={ACCOUNT_ACCESS_PRESETS.map((preset) => ({ label: t(ACCOUNT_ACCESS_PRESET_KEYS[preset]), value: preset }))} value={draft.preset} />
    <ListPicker label={t("ui.accountAccess.durationLabel")} onChange={(duration) => onChange({ duration: duration as AccountAccessDuration })} options={ACCOUNT_ACCESS_DURATIONS.map((duration) => ({ label: t(ACCOUNT_ACCESS_DURATION_KEYS[duration]), value: duration }))} value={draft.duration} />
    {draft.duration === "custom" ? <ListNumberRow label={t("ui.operations.restrictionHours")} max={87_600} onChange={(durationHours) => onChange({ durationHours })} unit={t("admin.unitHours")} value={draft.durationHours} /> : null}
    <ListNoteRow label={t("ui.accountAccess.messageLabel")} maxLength={500} onChange={(message) => onChange({ message })} value={draft.message} />
  </>;
}
