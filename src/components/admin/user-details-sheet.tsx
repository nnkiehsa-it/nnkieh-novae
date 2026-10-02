"use client";

import * as React from "react";
import { ShieldOff } from "lucide-react";

import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ListMutationRow, ListRow, ListSection, RowAction } from "@/components/ui/list";
import { AccountAccessEditor } from "@/components/admin/account-access-editor";
import type { AccountAccessRuleInput, AccountAccessMutation } from "@/hooks/use-admin-console";
import type { AdminUser } from "@/hooks/use-admin-console";
import { useI18n, type TranslationParams } from "@/i18n";
import { formatDate } from "@/lib/format";
import { ACCOUNT_ACCESS_PRESET_KEYS } from "@/constants/account-access";

export function isUserRestricted(user: AdminUser) {
  return Boolean(user.accessRule);
}

type Translator = (key: string, params?: TranslationParams) => string;

export function responsibilityLabel(user: AdminUser, t: Translator) {
  const labels: string[] = [];
  if (user.roles.includes("platform-admin")) labels.push(t("ui.adminConsole.platformAdmin"));
  if (user.roles.includes("announcement-manager")) labels.push(t("ui.adminConsole.announcementScope"));
  if (user.managedIssueCategoryIds.length > 0) labels.push(t("ui.adminConsole.issueScope", { count: user.managedIssueCategoryIds.length }));
  if (user.managedFacilityCategoryIds.length > 0) labels.push(t("ui.adminConsole.facilityScope", { count: user.managedFacilityCategoryIds.length }));
  return labels.length > 0 ? labels.join(" · ") : "—";
}

export function UserDetailsSheet({ busy, error, onClose, onReload, onRestrictionChange, user }: {
  busy: boolean;
  error: string;
  onClose: () => void;
  onReload: () => Promise<void>;
  onRestrictionChange: (input: AccountAccessRuleInput | null) => Promise<AccountAccessMutation | null>;
  user: AdminUser | null;
}) {
  const { t } = useI18n();
  const [shown, setShown] = React.useState<AdminUser | null>(user);
  if (user && user !== shown) setShown(user);
  const subject = user ?? shown;
  if (!subject) return null;
  const rule = subject.accessRule;

  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open={Boolean(user)}>
      <SheetContent>
        <SheetHeader><SheetTitle>{subject.name}</SheetTitle><SheetDescription>{subject.email ?? subject.uid}</SheetDescription></SheetHeader>
        <SheetBody>
          <div className="grid gap-5">
            <ListSection>
          <ListRow label="UID" value={<span className="font-mono text-xs">{subject.uid}</span>} />
          <ListRow label={t("ui.adminConsole.registeredAtColumn")} value={formatDate(subject.createdAt)} />
          <ListRow label={t("ui.adminConsole.accountStatus")} value={rule ? t(ACCOUNT_ACCESS_PRESET_KEYS[rule.preset]) : t("ui.adminConsole.normal")} />
          <ListRow label={t("ui.adminConsole.scopeColumn")} value={responsibilityLabel(subject, t)} />
            </ListSection>
        {rule ? <ListSection header={t("ui.accountAccess.effectiveRule")}>
          <ListRow label={rule.message} value={rule.permanent ? t("ui.accountAccess.duration.permanent") : rule.expiresAt ? formatDate(rule.expiresAt) : ""} />
          <ListRow label={t("ui.accountAccess.ruleSource")} value={rule.targetType === "uid" ? t("ui.accountAccess.source.uid") : `${rule.targetValue}*`} />
          {rule.targetType === "uid" ? <ListMutationRow action={<RowAction busy={busy} icon={ShieldOff} label={t("ui.adminConsole.clearRestriction")} onClick={() => void onRestrictionChange(null).catch(() => {})} tone="destructive" />} label={t("ui.adminConsole.clearRestriction")} /> : null}
        </ListSection> : null}
        {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
        {!subject.roles.includes("platform-admin") ? <>
          <h2 className="text-xs font-medium text-muted-foreground">{t(rule?.targetType === "uid" ? "ui.accountAccess.replaceRule" : "ui.accountAccess.addOverride")}</h2>
          <AccountAccessEditor busy={busy} key={subject.uid} onReload={onReload} onSave={onRestrictionChange}
            revision={subject.accessRuleRevision} rule={rule?.targetType === "uid" ? rule : null} targetType="uid" targetValue={subject.uid} />
        </> : <ListSection><ListRow label={t("ui.adminConsole.platformAdminRestrictionNotice")} /></ListSection>}
          </div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
