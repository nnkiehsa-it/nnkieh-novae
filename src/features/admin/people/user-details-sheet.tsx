import * as React from "react";
import { ShieldSlash } from "@phosphor-icons/react/ssr";
import type { AccountAccessMutation, AccountAccessRuleInput, AdminUser } from "@/hooks/use-admin-console";
import { useAdminDraftExit } from "@/hooks/use-admin-draft-exit";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { ListGroup, ListRow } from "@/ui/list";
import { SectionTitle } from "@/ui/panel";
import { Sheet } from "@/ui/sheet";
import { InlineAlert } from "../shared/feedback";
import { ReviewDialog } from "../shared/review-dialog";
import { FieldRow } from "../shared/rows";
import { useRetained } from "../shared/use-retained";
import { presetLabel } from "./account-access-labels";
import { AccountAccessEditor } from "./account-access-editor";
import { isPlatformAdmin, responsibilityLabel } from "./user-summary";

/**
 * One account in full: who they are, the rule that currently applies to them,
 * and the individual rule that can be set or cleared. Closing it with
 * unsaved edits asks first.
 */
export function UserDetailsSheet({ busy, error, onClose, onReload, onRestrictionChange, user }: {
  busy: boolean;
  error: string;
  onClose: () => void;
  onReload: () => Promise<void>;
  onRestrictionChange: (input: AccountAccessRuleInput | null) => Promise<AccountAccessMutation | null>;
  user: AdminUser | null;
}) {
  const { t } = useI18n();
  const [clearing, setClearing] = React.useState(false);
  const exit = useAdminDraftExit("account-access-uid", busy, onClose);
  const subject = useRetained(user);
  if (!subject) return null;
  const rule = subject.accessRule;
  const individual = rule?.targetType === "uid" ? rule : null;

  return (
    <>
      <Sheet
        description={subject.email ?? subject.uid}
        onOpenChange={(open) => { if (!open) exit.requestClose(); }}
        open={user !== null}
        title={subject.name}
      >
        <div className="grid gap-5">
          <ListGroup label={subject.name}>
            <FieldRow label={t("ui.adminConsole.detailUserId")} mono value={subject.uid} />
            <FieldRow label={t("ui.adminConsole.registeredAtColumn")} value={formatDate(subject.createdAt)} />
            <FieldRow label={t("ui.adminConsole.accountStatus")} value={rule ? presetLabel(rule.preset, t) : t("ui.adminConsole.normal")} />
            <FieldRow label={t("ui.adminConsole.scopeColumn")} value={responsibilityLabel(subject, t) || "—"} />
          </ListGroup>
          {rule ? (
            <ListGroup title={t("ui.accountAccess.effectiveRule")}>
              <FieldRow label={t("ui.accountAccess.messageLabel")} value={rule.message} />
              <FieldRow
                label={t("ui.accountAccess.durationLabel")}
                value={rule.permanent ? t("ui.accountAccess.duration.permanent") : rule.expiresAt ? formatDate(rule.expiresAt) : "—"}
              />
              <FieldRow
                label={t("ui.accountAccess.ruleSource")}
                value={rule.targetType === "uid" ? t("ui.accountAccess.source.uid") : `${rule.targetValue}*`}
              />
              {individual ? (
                <ListRow
                  disabled={busy}
                  icon={<ShieldSlash />}
                  label={t("ui.adminConsole.clearRestriction")}
                  onClick={() => setClearing(true)}
                  tone="danger"
                />
              ) : null}
            </ListGroup>
          ) : null}
          {error ? <InlineAlert>{error}</InlineAlert> : null}
          {isPlatformAdmin(subject) ? (
            <ListGroup label={t("ui.adminConsole.platformAdmin")}>
              <ListRow label={t("ui.adminConsole.platformAdminRestrictionNotice")} />
            </ListGroup>
          ) : (
            <section className="grid gap-2">
              <SectionTitle>{t(individual ? "ui.accountAccess.replaceRule" : "ui.accountAccess.addOverride")}</SectionTitle>
              <AccountAccessEditor
                busy={busy}
                key={subject.uid}
                onReload={onReload}
                onSave={onRestrictionChange}
                revision={subject.accessRuleRevision}
                rule={individual}
                targetType="uid"
                targetValue={subject.uid}
              />
            </section>
          )}
        </div>
      </Sheet>
      {exit.prompt}
      <ReviewDialog
        changes={individual ? [{ after: null, before: presetLabel(individual.preset, t), key: "rule" }] : []}
        confirmLabel={t("ui.adminConsole.clearRestriction")}
        describeChange={() => subject.email ?? subject.uid}
        description={t("admin.removeIndividualRuleDescription")}
        onCancel={() => setClearing(false)}
        onConfirm={() => { setClearing(false); void onRestrictionChange(null).catch(() => undefined); }}
        open={clearing}
      />
    </>
  );
}
