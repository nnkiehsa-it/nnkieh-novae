"use client";

import * as React from "react";
import { ShieldOff } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ListMutationRow, ListRow, ListSection, RowAction } from "@/components/ui/list";
import { AccountAccessRuleFields, type AccountAccessRuleDraft } from "@/components/admin/account-access-rule-fields";
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

export function UserDetailsSheet({ busy, onClose, onRestrictionChange, user }: {
  busy: boolean;
  onClose: () => void;
  onRestrictionChange: (input: Omit<AccountAccessRuleDraft, "durationHours"> & { durationHours?: number } | null) => void;
  user: AdminUser | null;
}) {
  const { t } = useI18n();
  const [shown, setShown] = React.useState<AdminUser | null>(user);
  const [draft, setDraft] = React.useState<AccountAccessRuleDraft>({ duration: "7d", durationHours: 24, message: "", preset: "read_only" });
  if (user && user !== shown) setShown(user);
  const subject = user ?? shown;
  if (!subject) return null;
  const rule = subject.accessRule;
  const updateDraft = (next: Partial<AccountAccessRuleDraft>) => setDraft((current) => ({ ...current, ...next }));
  const submit = () => onRestrictionChange({
    duration: draft.duration,
    ...(draft.duration === "custom" ? { durationHours: draft.durationHours } : {}),
    message: draft.message,
    preset: draft.preset,
  });

  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open={Boolean(user)}>
      <SheetContent>
        <SheetHeader><SheetTitle>{subject.name}</SheetTitle><SheetDescription>{subject.email ?? subject.uid}</SheetDescription></SheetHeader>
        <ListSection>
          <ListRow label="UID" value={<span className="font-mono text-xs">{subject.uid}</span>} />
          <ListRow label={t("ui.adminConsole.registeredAtColumn")} value={formatDate(subject.createdAt)} />
          <ListRow label={t("ui.adminConsole.accountStatus")} value={rule ? t(ACCOUNT_ACCESS_PRESET_KEYS[rule.preset]) : t("ui.adminConsole.normal")} />
          <ListRow label={t("ui.adminConsole.scopeColumn")} value={responsibilityLabel(subject, t)} />
        </ListSection>
        {rule ? <ListSection header={t("ui.accountAccess.effectiveRule")}>
          <ListRow label={rule.message} value={rule.permanent ? t("ui.accountAccess.duration.permanent") : rule.expiresAt ? formatDate(rule.expiresAt) : ""} />
          <ListRow label={t("ui.accountAccess.ruleSource")} value={rule.targetType === "uid" ? t("ui.accountAccess.source.uid") : `${rule.targetValue}*`} />
          {rule.targetType === "uid" ? <ListMutationRow action={<RowAction busy={busy} icon={ShieldOff} label={t("ui.adminConsole.clearRestriction")} onClick={() => onRestrictionChange(null)} tone="destructive" />} label={t("ui.adminConsole.clearRestriction")} /> : null}
        </ListSection> : null}
        {!subject.roles.includes("platform-admin") ? <ListSection header={rule?.targetType === "uid" ? t("ui.accountAccess.replaceRule") : t("ui.accountAccess.addOverride")}>
          <AccountAccessRuleFields draft={draft} onChange={updateDraft} />
          <div className="flex justify-end p-[var(--row-padding-block)]"><Button disabled={busy || !draft.message.trim()} onClick={submit}>{t("ui.accountAccess.apply")}</Button></div>
        </ListSection> : <ListSection><ListRow label={t("ui.adminConsole.platformAdminRestrictionNotice")} /></ListSection>}
      </SheetContent>
    </Sheet>
  );
}
