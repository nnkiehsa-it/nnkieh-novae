"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ListMutationRow, ListRow, ListSection, RowAction } from "@/components/ui/list";
import { AccountAccessRuleFields, type AccountAccessRuleDraft } from "@/components/admin/account-access-rule-fields";
import { ErrorState } from "@/components/ui/page-state";
import { useAccountAccessRules, type AccountAccessDuration, type AccountAccessPreset, type AccountAccessRule } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { ACCOUNT_ACCESS_PRESET_KEYS } from "@/constants/account-access";

function PrefixRuleDialog({ busy, onClose, onSave, rule }: {
  busy: boolean;
  onClose: () => void;
  onSave: (input: { duration: AccountAccessDuration; durationHours?: number; message: string; preset: AccountAccessPreset; targetType: "email_prefix"; targetValue: string }) => Promise<void>;
  rule: AccountAccessRule | null | undefined;
}) {
  const { t } = useI18n();
  const [targetValue, setTargetValue] = React.useState(rule?.targetValue ?? "");
  const [preset, setPreset] = React.useState<AccountAccessPreset>(rule?.preset ?? "read_only");
  const [duration, setDuration] = React.useState<AccountAccessDuration>(rule?.permanent ? "permanent" : "7d");
  const [durationHours, setDurationHours] = React.useState(24);
  const [message, setMessage] = React.useState(rule?.message ?? "");
  const open = rule !== undefined;

  React.useLayoutEffect(() => {
    if (rule === undefined) return;
    setTargetValue(rule?.targetValue ?? "");
    setPreset(rule?.preset ?? "read_only");
    setDuration(rule?.permanent ? "permanent" : "7d");
    setDurationHours(24);
    setMessage(rule?.message ?? "");
  }, [rule]);

  return <Sheet onOpenChange={(next) => !next && onClose()} open={open}>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>{rule ? t("ui.accountAccess.editPrefix") : t("ui.accountAccess.addPrefix")}</SheetTitle>
        <SheetDescription>{t("ui.accountAccess.prefixDescription")}</SheetDescription>
      </SheetHeader>
      <ListSection>
        <AccountAccessRuleFields
          draft={{ duration, durationHours, message, preset } satisfies AccountAccessRuleDraft}
          onChange={(next) => {
            if (next.duration) setDuration(next.duration);
            if (next.durationHours !== undefined) setDurationHours(next.durationHours);
            if (next.message !== undefined) setMessage(next.message);
            if (next.preset) setPreset(next.preset);
          }}
          onTargetChange={setTargetValue}
          targetDisabled={Boolean(rule)}
          targetValue={targetValue}
        />
      </ListSection>
      <div className="flex justify-end"><Button disabled={busy || !targetValue.trim() || !message.trim()} onClick={() => void onSave({ duration, ...(duration === "custom" ? { durationHours } : {}), message, preset, targetType: "email_prefix", targetValue }).then(onClose)}>{t("ui.accountAccess.apply")}</Button></div>
    </SheetContent>
  </Sheet>;
}

export function AccountAccessRules() {
  const { t } = useI18n();
  const state = useAccountAccessRules();
  const [editing, setEditing] = React.useState<AccountAccessRule | null | undefined>(undefined);
  if (state.error && state.rules.length === 0) return <ErrorState error={state.error} onRetry={() => void state.load()} />;
  return <>
    <div className="flex justify-end"><Button onClick={() => setEditing(null)}><Plus />{t("ui.accountAccess.addPrefix")}</Button></div>
    <ListSection>
      {state.rules.filter((rule) => rule.targetType === "email_prefix").map((rule) => <ListMutationRow
        action={<RowAction busy={state.busy === rule.targetValue} icon={Trash2} label={t("ui.accountAccess.deleteRule")} onClick={() => void state.remove(rule)} tone="destructive" />}
        key={rule.targetValue}
        label={`${rule.targetValue}*`}
        onOpen={() => setEditing(rule)}
        openLabel={t("ui.accountAccess.editPrefix")}
        value={`${t(ACCOUNT_ACCESS_PRESET_KEYS[rule.preset])} · ${t("ui.accountAccess.matchCount", { count: rule.matchCount })} · ${rule.permanent ? t("ui.accountAccess.duration.permanent") : rule.expiresAt ? formatDate(rule.expiresAt) : ""}`}
      />)}
      {!state.loading && state.rules.every((rule) => rule.targetType !== "email_prefix") ? <ListRow label={t("ui.accountAccess.noPrefixRules")} /> : null}
    </ListSection>
    <PrefixRuleDialog busy={Boolean(state.busy)} onClose={() => setEditing(undefined)} onSave={state.save} rule={editing} />
  </>;
}
