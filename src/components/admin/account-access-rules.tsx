"use client";

import * as React from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ListMutationRow, ListRow, ListSection, RowAction } from "@/components/ui/list";
import { AccountAccessEditor } from "@/components/admin/account-access-editor";
import { ApplyReviewDialog } from "@/components/admin/apply-review-dialog";
import { ErrorState } from "@/components/ui/page-state";
import { useAccountAccessRules, type AccountAccessRule } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { useAdminDraftExit } from "@/hooks/use-admin-draft-exit";
import { formatDate } from "@/lib/format";
import { ACCOUNT_ACCESS_PRESET_KEYS } from "@/constants/account-access";

export function AccountAccessRules() {
  const { t } = useI18n();
  const state = useAccountAccessRules();
  const [editing, setEditing] = React.useState<string | null | undefined>(undefined);
  const [removing, setRemoving] = React.useState<AccountAccessRule | null>(null);
  const rule = state.rules.find((item) => item.targetType === "email_prefix" && item.targetValue === editing) ?? null;
  const disabled = Boolean(state.busy) || state.loading;
  const exit = useAdminDraftExit("account-access-email_prefix", Boolean(state.busy), () => setEditing(undefined));
  if (state.error && state.rules.length === 0) return <ErrorState error={state.error} onRetry={() => void state.load()} />;
  return <>
    <div className="flex justify-end gap-2">
      <Button disabled={disabled} onClick={() => void state.load()} variant="secondary"><RefreshCw />{t("ui.adminConsole.refresh")}</Button>
      <Button disabled={disabled} onClick={() => setEditing(null)}><Plus />{t("ui.accountAccess.addPrefix")}</Button>
    </div>
    {state.error || state.mutationError ? <p className="text-sm text-destructive" role="alert">{state.error || state.mutationError}</p> : null}
    <ListSection>
      {state.rules.filter((item) => item.targetType === "email_prefix").map((item) => <ListMutationRow
        action={<RowAction busy={state.busy === item.targetValue} disabled={disabled} icon={Trash2} label={t("ui.accountAccess.deleteRule")} onClick={() => setRemoving(item)} tone="destructive" />}
        key={item.targetValue} label={<span className="break-all">{item.targetValue}*</span>}
        onOpen={disabled ? undefined : () => setEditing(item.targetValue)} openLabel={t("ui.accountAccess.editPrefix")}
        detail={`${t(ACCOUNT_ACCESS_PRESET_KEYS[item.preset])} · ${t("ui.accountAccess.matchCount", { count: item.matchCount })}`}
        value={<span className="text-xs">{!item.active ? t("ui.accountAccess.expired") : item.permanent ? t("ui.accountAccess.duration.permanent") : item.expiresAt ? formatDate(item.expiresAt) : ""}</span>}
      />)}
      {!state.loading && !state.error && state.rules.every((item) => item.targetType !== "email_prefix") ? <ListRow label={t("ui.accountAccess.noPrefixRules")} /> : null}
    </ListSection>
    <Sheet onOpenChange={(open) => !open && exit.requestClose()} open={editing !== undefined}>
      <SheetContent>
        <SheetHeader><SheetTitle>{editing === null ? t("ui.accountAccess.addPrefix") : t("ui.accountAccess.editPrefix")}</SheetTitle><SheetDescription>{t("ui.accountAccess.prefixDescription")}</SheetDescription></SheetHeader>
        <SheetBody><div className="grid gap-5">
          {editing !== undefined ? <AccountAccessEditor busy={Boolean(state.busy)} key={editing ?? "new"} missing={typeof editing === "string" && !rule}
            onReload={state.load} onSave={state.save} onSaved={() => setEditing(undefined)} revision={rule?.revision ?? null}
            rule={rule} targetType="email_prefix" targetValue={editing ?? ""} /> : null}
        </div></SheetBody>
      </SheetContent>
    </Sheet>
    {exit.prompt}
    <ApplyReviewDialog changes={removing ? [{ key: "prefix", before: `${removing.targetValue}*`, after: null }] : []}
      describeChange={() => t("ui.accountAccess.prefixLabel")} description={t("ui.accountAccess.removePrefixDescription")}
      confirmLabel={t("ui.accountAccess.deleteRule")} onCancel={() => setRemoving(null)}
      onConfirm={() => { const current = removing; setRemoving(null); if (current) void state.remove(current); }} open={Boolean(removing)} />
  </>;
}
