"use client";

import { Button } from "@/components/ui/button";
import { ListSection } from "@/components/ui/list";
import { AccountAccessRuleFields } from "@/components/admin/account-access-rule-fields";
import { ApplyReviewDialog } from "@/components/admin/apply-review-dialog";
import { useAccountAccessDraft, type AccountAccessDraftOptions } from "@/hooks/use-account-access-draft";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { ACCOUNT_ACCESS_DURATION_KEYS, ACCOUNT_ACCESS_PRESET_KEYS } from "@/constants/account-access";

export function AccountAccessEditor({ busy, missing = false, onReload, onSave, onSaved, revision, rule, targetType, targetValue }: {
  busy: boolean;
  missing?: boolean;
  onReload: () => Promise<void>;
} & AccountAccessDraftOptions) {
  const { t } = useI18n();
  const draft = useAccountAccessDraft({ onSave, onSaved, revision, rule, targetType, targetValue });
  if (!draft.value) return null;
  const value = draft.value;
  const saving = busy || draft.status === "saving";
  const fields = (["targetValue", "preset", "duration", "durationHours", "message"] as const)
    .filter((key) => key !== "durationHours" || value.duration === "custom");
  const changes = draft.baseline?.revision === null
    ? fields.map((key) => ({ key, before: null, after: value[key] }))
    : draft.changes.filter((change) => fields.some((key) => key === change.key));
  const labels: Record<string, string> = { duration: "ui.accountAccess.durationLabel", durationHours: "ui.operations.restrictionHours",
    message: "ui.accountAccess.messageLabel", preset: "ui.accountAccess.presetLabel", targetValue: "ui.accountAccess.prefixLabel" };
  return <>
    <ListSection>
      <AccountAccessRuleFields disabled={saving} draft={value} onChange={draft.update} hasExisting={Boolean(value.keptDeadline || value.keptPermanent)}
        keptDeadline={value.keptDeadline} keptPermanent={value.keptPermanent}
        onTargetChange={targetType === "email_prefix" ? (targetValue) => draft.update({ targetValue: targetValue.trim().toLowerCase() }) : undefined}
        targetDisabled={Boolean(rule)} targetValue={value.targetValue} />
    </ListSection>
    {missing || draft.error ? <div className="grid gap-2" role="alert">
      <p className="text-sm text-destructive">{missing ? t("ui.accountAccess.ruleMissing") : draft.error}</p>
      <Button disabled={saving} onClick={() => { draft.reset(); void onReload(); }} variant="secondary">{t("ui.accountAccess.reloadLatest")}</Button>
    </div> : null}
    <div className="flex justify-end gap-2">
      <Button disabled={saving || !draft.dirty} onClick={draft.reset} variant="secondary">{t("common.reset")}</Button>
      <Button disabled={saving || missing || !draft.dirty || !draft.valid} onClick={() => void draft.submit()}>{t("ui.accountAccess.apply")}</Button>
    </div>
    <ApplyReviewDialog changes={changes} describeChange={(key) => t(labels[key])}
      description={<>
        {t("ui.accountAccess.reviewPrefix", { count: draft.impact?.totalEstimatedRows ?? 0, prefix: value.targetValue })}
        <span className="mt-2 block">{t(ACCOUNT_ACCESS_PRESET_KEYS[value.preset])} · {value.duration === "keep"
          ? value.keptPermanent ? t("ui.accountAccess.duration.permanent") : value.keptDeadline ? formatDate(new Date(value.keptDeadline)) : "—"
          : t(ACCOUNT_ACCESS_DURATION_KEYS[value.duration])}{value.duration === "custom" ? ` · ${value.durationHours} ${t("admin.unitHours")}` : ""}</span>
      </>}
      confirmLabel={t("ui.accountAccess.apply")} impact={draft.impact} onCancel={draft.cancel}
      onConfirm={() => void draft.confirm()} open={Boolean(draft.impact)}
      formatChangeValue={(change, field) => {
        if (field === null) return "—";
        if (change.key === "preset") return t(ACCOUNT_ACCESS_PRESET_KEYS[field as keyof typeof ACCOUNT_ACCESS_PRESET_KEYS]);
        if (change.key === "duration") return field === "keep"
          ? value.keptPermanent ? t("ui.accountAccess.duration.permanent") : value.keptDeadline ? formatDate(new Date(value.keptDeadline)) : "—"
          : t(ACCOUNT_ACCESS_DURATION_KEYS[field as keyof typeof ACCOUNT_ACCESS_DURATION_KEYS]);
        if (change.key === "durationHours") return `${field} ${t("admin.unitHours")}`;
        return typeof field === "string" && field ? field : "—";
      }} />
  </>;
}
