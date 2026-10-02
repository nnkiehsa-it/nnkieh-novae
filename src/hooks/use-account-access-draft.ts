"use client";

import * as React from "react";
import { useDraft } from "@/hooks/use-draft";
import { useI18n } from "@/i18n";
import { previewAccountAccessRule, type AccountAccessRule, type AccountAccessRuleInput, type AccountAccessTargetType } from "@/services/admin-console";
import type { AccountAccessMutation } from "@/hooks/use-admin-console";

type Values = AccountAccessRuleInput & { durationHours: number; keptDeadline: string | null; keptPermanent: boolean };

function fromRule(rule: AccountAccessRule | null, targetType: AccountAccessTargetType, targetValue: string, revision: string | null): Values {
  return { duration: rule ? "keep" : "7d", durationHours: 24, message: rule?.message ?? "", preset: rule?.preset ?? "read_only",
    revision, targetType, targetValue, keptDeadline: rule?.expiresAt?.toISOString() ?? null, keptPermanent: rule?.permanent ?? false };
}

function input(value: Values, baseline: Values): AccountAccessRuleInput {
  return { duration: value.duration, ...(value.duration === "custom" ? { durationHours: value.durationHours } : {}),
    message: value.message, preset: value.preset, revision: baseline.revision, targetType: value.targetType, targetValue: value.targetValue };
}

export interface AccountAccessDraftOptions {
  onSave: (input: AccountAccessRuleInput) => Promise<AccountAccessMutation | null>;
  onSaved?: () => void;
  revision: string | null;
  rule: AccountAccessRule | null;
  targetType: AccountAccessTargetType;
  targetValue: string;
}

export function useAccountAccessDraft({ onSave, onSaved, revision, rule, targetType, targetValue }: AccountAccessDraftOptions) {
  const { t } = useI18n();
  const source = React.useMemo(() => fromRule(rule, targetType, targetValue, revision), [rule, targetType, targetValue, revision]);
  return useDraft({
    source,
    validate: (value) => Boolean(value.message.trim()) && value.message.trim().length <= 500
      && (value.duration !== "custom" || Number.isInteger(value.durationHours) && value.durationHours >= 1 && value.durationHours <= 87_600)
      && (value.targetType !== "email_prefix" || /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}$/u.test(value.targetValue)),
    estimate: targetType === "email_prefix" ? async (value, baseline) => {
      const preview = await previewAccountAccessRule(input(value, baseline));
      return { confirmationRequired: true, details: {}, totalEstimatedRows: preview.matchingCount };
    } : undefined,
    save: async (value, _reason, baseline) => {
      const saved = await onSave(input(value, baseline));
      if (!saved) throw new Error(t("ui.common.operationFailed"));
      onSaved?.();
      return fromRule(saved.rule, saved.targetType, saved.targetValue, saved.revision);
    },
  });
}
