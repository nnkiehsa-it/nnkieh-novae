"use client";

import { ACCOUNT_ACCESS_DURATIONS, ACCOUNT_ACCESS_DURATION_KEYS, ACCOUNT_ACCESS_PRESETS } from "@/constants/account-access";
import type { AccountAccessDuration, AccountAccessPreset } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { ListRow } from "@/ui/list";
import { InputRow, NoteRow, NumberRow, PickerRow } from "@/ui/list-controls";
import { keptLabel, presetLabel, type KeptDeadline } from "./account-access-labels";

export interface AccountAccessRuleValue extends KeptDeadline {
  duration: AccountAccessDuration;
  durationHours: number;
  message: string;
  preset: AccountAccessPreset;
  targetValue: string;
}

const MAX_RESTRICTION_HOURS = 87_600;

/** The rows of an access rule: who it matches (prefix rules only), how strict it is, for how long, and what the person is told. */
export function AccountAccessRuleFields({ disabled, onChange, prefix, value }: {
  disabled: boolean;
  onChange: (patch: Partial<AccountAccessRuleValue>) => void;
  /** Present for email-prefix rules; `locked` once the rule exists, since the prefix identifies it. */
  prefix?: { locked: boolean };
  value: AccountAccessRuleValue;
}) {
  const { t } = useI18n();
  const hasKept = Boolean(value.keptDeadline || value.keptPermanent);
  return (
    <>
      {prefix ? (
        <InputRow
          disabled={disabled || prefix.locked}
          label={t("ui.accountAccess.prefixLabel")}
          maxLength={64}
          onChange={(next) => onChange({ targetValue: next.trim().toLowerCase() })}
          placeholder="hs"
          value={value.targetValue}
        />
      ) : null}
      <PickerRow
        disabled={disabled}
        label={t("ui.accountAccess.presetLabel")}
        onChange={(preset) => onChange({ preset })}
        options={ACCOUNT_ACCESS_PRESETS.map((preset) => ({ label: presetLabel(preset, t), value: preset }))}
        value={value.preset}
      />
      <PickerRow
        disabled={disabled}
        label={t("ui.accountAccess.durationLabel")}
        onChange={(duration) => onChange({ duration })}
        options={ACCOUNT_ACCESS_DURATIONS
          .filter((duration) => duration !== "keep" || hasKept)
          .map((duration) => ({ label: t(ACCOUNT_ACCESS_DURATION_KEYS[duration]), value: duration }))}
        value={value.duration}
      />
      <ListRow label={value.duration === "keep" ? keptLabel(value, t) : t("ui.accountAccess.deadlineFromSave")} />
      {value.duration === "custom" ? (
        <NumberRow
          disabled={disabled}
          label={t("ui.operations.restrictionHours")}
          max={MAX_RESTRICTION_HOURS}
          onChange={(durationHours) => onChange({ durationHours })}
          unit={t("admin.unitHours")}
          value={value.durationHours}
        />
      ) : null}
      <NoteRow disabled={disabled} label={t("ui.accountAccess.messageLabel")} maxLength={500} onChange={(message) => onChange({ message })} value={value.message} />
    </>
  );
}
