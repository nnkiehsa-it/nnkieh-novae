import * as React from "react";
import { ArrowClockwise, PencilSimple, Plus, Trash } from "@phosphor-icons/react/ssr";
import { useAccountAccessRules, type AccountAccessRule } from "@/hooks/use-admin-console";
import { useAdminDraftExit } from "@/hooks/use-admin-draft-exit";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { Button } from "@/ui/button";
import { ListGroup, ListRow } from "@/ui/list";
import { Sheet } from "@/ui/sheet";
import { InlineAlert, LoadError } from "../shared/feedback";
import { IconAction } from "../shared/icon-actions";
import { ReviewDialog } from "../shared/review-dialog";
import type { Translate } from "../shared/translate";
import { presetLabel } from "./account-access-labels";
import { AccountAccessEditor } from "./account-access-editor";

function expiryLabel(rule: AccountAccessRule, t: Translate) {
  if (!rule.active) return t("ui.accountAccess.expired");
  if (rule.permanent) return t("ui.accountAccess.duration.permanent");
  return rule.expiresAt ? formatDate(rule.expiresAt) : "";
}

/**
 * Rules that reach every account whose email starts with a prefix. `editing`
 * is the prefix being edited, `null` for a new one, and `undefined` while the
 * editor is closed.
 */
export function AccountAccessRules() {
  const { t } = useI18n();
  const state = useAccountAccessRules();
  const [editing, setEditing] = React.useState<string | null | undefined>(undefined);
  const [removing, setRemoving] = React.useState<AccountAccessRule | null>(null);
  const exit = useAdminDraftExit("account-access-email_prefix", Boolean(state.busy), () => setEditing(undefined));
  const rules = state.rules.filter((rule) => rule.targetType === "email_prefix");
  const rule = rules.find((item) => item.targetValue === editing) ?? null;
  const disabled = Boolean(state.busy) || state.loading;

  if (state.error && state.rules.length === 0) return <LoadError message={state.error} onRetry={() => void state.load()} />;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        <Button disabled={disabled} onClick={() => void state.load()}><ArrowClockwise />{t("ui.adminConsole.refresh")}</Button>
        <Button disabled={disabled} onClick={() => setEditing(null)} variant="primary"><Plus />{t("ui.accountAccess.addPrefix")}</Button>
      </div>
      {state.error || state.mutationError ? <InlineAlert>{state.error || state.mutationError}</InlineAlert> : null}
      <ListGroup label={t("ui.accountAccess.rulesTab")}>
        {rules.map((item) => (
          <ListRow
            detail={`${presetLabel(item.preset, t)} · ${t("ui.accountAccess.matchCount", { count: item.matchCount })}`}
            key={item.targetValue}
            label={<span className="break-all">{item.targetValue}*</span>}
            trailing={
              <>
                <IconAction disabled={disabled} icon={<PencilSimple />} label={t("ui.accountAccess.editPrefix")} onClick={() => setEditing(item.targetValue)} />
                <IconAction
                  busy={state.busy === item.targetValue}
                  disabled={disabled}
                  icon={<Trash />}
                  label={t("ui.accountAccess.deleteRule")}
                  onClick={() => setRemoving(item)}
                  tone="danger"
                />
              </>
            }
            value={expiryLabel(item, t)}
          />
        ))}
        {!state.loading && !state.error && rules.length === 0 ? <ListRow label={t("ui.accountAccess.noPrefixRules")} /> : null}
      </ListGroup>
      <Sheet
        description={t("ui.accountAccess.prefixDescription")}
        onOpenChange={(open) => { if (!open) exit.requestClose(); }}
        open={editing !== undefined}
        title={t(editing === null ? "ui.accountAccess.addPrefix" : "ui.accountAccess.editPrefix")}
      >
        {editing !== undefined ? (
          <AccountAccessEditor
            busy={Boolean(state.busy)}
            key={editing ?? "new"}
            missing={typeof editing === "string" && !rule}
            onReload={state.load}
            onSave={state.save}
            onSaved={() => setEditing(undefined)}
            revision={rule?.revision ?? null}
            rule={rule}
            targetType="email_prefix"
            targetValue={editing ?? ""}
          />
        ) : null}
      </Sheet>
      {exit.prompt}
      <ReviewDialog
        changes={removing ? [{ after: null, before: `${removing.targetValue}*`, key: "prefix" }] : []}
        confirmLabel={t("ui.accountAccess.deleteRule")}
        describeChange={() => t("ui.accountAccess.prefixLabel")}
        description={t("ui.accountAccess.removePrefixDescription")}
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          const current = removing;
          setRemoving(null);
          if (current) void state.remove(current);
        }}
        open={removing !== null}
      />
    </div>
  );
}
