"use client";

import { useAccountAccessDraft, type AccountAccessDraftOptions } from "@/hooks/use-account-access-draft";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { useI18n } from "@/i18n";
import { Button } from "@/ui/button";
import { ListGroup } from "@/ui/list";
import { InlineAlert } from "../shared/feedback";
import { ReviewDialog } from "../shared/review-dialog";
import { durationLabel, presetLabel } from "./account-access-labels";
import { AccountAccessRuleFields } from "./account-access-rule-fields";

const FIELD_LABEL_KEYS: Record<string, string> = {
  duration: "ui.accountAccess.durationLabel",
  durationHours: "ui.operations.restrictionHours",
  message: "ui.accountAccess.messageLabel",
  preset: "ui.accountAccess.presetLabel",
  targetValue: "ui.accountAccess.prefixLabel",
};

/**
 * Editing one account access rule, for one account or for an email prefix.
 * An email-prefix rule asks for confirmation first, with how many accounts it reaches.
 */
export function AccountAccessEditor({ busy, missing = false, onReload, onSave, onSaved, revision, rule, targetType, targetValue, title }: {
  busy: boolean;
  /** The rule being edited was removed elsewhere. */
  missing?: boolean;
  onReload: () => Promise<void>;
  title?: string;
} & AccountAccessDraftOptions) {
  const { t } = useI18n();
  const draft = useAccountAccessDraft({ onSave, onSaved, revision, rule, targetType, targetValue });
  const saving = busy || draft.status === "saving";
  useUnsavedChanges(draft.changes.length, draft.reset, `account-access-${targetType}`, saving);
  const value = draft.value;
  if (!value) return null;

  const fields = (["targetValue", "preset", "duration", "durationHours", "message"] as const)
    .filter((key) => key !== "durationHours" || value.duration === "custom");
  const changes = draft.baseline?.revision === null
    ? fields.map((key) => ({ key, before: null, after: value[key] }))
    : draft.changes.filter((change) => fields.some((key) => key === change.key));

  const formatChangeValue = (change: { key: string }, field: unknown) => {
    if (field === null) return "—";
    if (change.key === "preset") return presetLabel(field as typeof value.preset, t);
    if (change.key === "duration") return durationLabel(field as typeof value.duration, value, t);
    if (change.key === "durationHours") return `${field} ${t("admin.unitHours")}`;
    return typeof field === "string" && field ? field : "—";
  };

  return (
    <div className="grid gap-4">
      <ListGroup label={t("ui.accountAccess.rulesTab")} title={title}>
        <AccountAccessRuleFields
          disabled={saving}
          onChange={draft.update}
          prefix={targetType === "email_prefix" ? { locked: Boolean(rule) } : undefined}
          value={value}
        />
      </ListGroup>
      {missing || draft.error ? (
        <div className="grid gap-2">
          <InlineAlert>{missing ? t("ui.accountAccess.ruleMissing") : draft.error}</InlineAlert>
          <Button disabled={saving} onClick={() => { draft.reset(); void onReload(); }} size="sm">
            {t("ui.accountAccess.reloadLatest")}
          </Button>
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button disabled={saving || !draft.dirty} onClick={draft.reset}>{t("common.reset")}</Button>
        <Button
          disabled={missing || !draft.dirty || !draft.valid}
          onClick={() => void draft.submit()}
          status={saving ? "loading" : "idle"}
          variant="primary"
        >
          {t("ui.accountAccess.apply")}
        </Button>
      </div>
      <ReviewDialog
        changes={changes}
        confirmLabel={t("ui.accountAccess.apply")}
        describeChange={(key) => t(FIELD_LABEL_KEYS[key])}
        description={
          <>
            {t("ui.accountAccess.reviewPrefix", { count: draft.impact?.totalEstimatedRows ?? 0, prefix: value.targetValue })}
            <span className="mt-2 block">
              {presetLabel(value.preset, t)} · {durationLabel(value.duration, value, t)}
              {value.duration === "custom" ? ` · ${value.durationHours} ${t("admin.unitHours")}` : ""}
            </span>
          </>
        }
        formatChangeValue={formatChangeValue}
        impact={draft.impact}
        onCancel={draft.cancel}
        onConfirm={() => void draft.confirm()}
        open={Boolean(draft.impact)}
      />
    </div>
  );
}
