"use client";

import { useAdminView } from "@/hooks/use-admin-view";
import * as React from "react";
import { getUnsavedChanges } from "@/hooks/unsaved-changes-store";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

import { useI18n } from "@/i18n";
import { AccessManagement } from "@/components/admin/access-management";
import { UserManagement } from "@/components/admin/user-management";
import { AccountAccessRules } from "@/components/admin/account-access-rules";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ContentTransition, StateTransition } from "@/components/motion/state-transition";

/**
 * Accounts and category responsibility are two readings of one relationship, so
 * they share a screen: by person, or by the area being managed.
 */
export function PeopleConsole() {
  const { t } = useI18n();
  const [view, setView] = useAdminView(["accounts", "scopes", "restrictions"] as const);
  const [pendingView, setPendingView] = React.useState<string | null>(null);
  return (
    <div className="space-y-6">
      <LiquidTabs
        ariaLabel={t("admin.peopleTitle")}
        onValueChange={(next) => {
          if (getUnsavedChanges().count > 0) setPendingView(next);
          else setView(next);
        }}
        options={[
          { label: t("admin.peopleByAccount"), value: "accounts" },
          { label: t("admin.peopleByScope"), value: "scopes" },
          { label: t("ui.accountAccess.rulesTab"), value: "restrictions" },
        ]}
        value={view}
      />
      <StateTransition className="min-w-0" data-admin-content identity={view}>
        <ContentTransition identity={view}>
          {view === "accounts" ? <UserManagement /> : view === "scopes" ? <AccessManagement /> : <AccountAccessRules />}
        </ContentTransition>
      </StateTransition>
      <AlertDialog open={pendingView !== null} onOpenChange={(open) => !open && setPendingView(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.leaveTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("admin.leaveMessage", { count: getUnsavedChanges().count })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("admin.leaveStay")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              getUnsavedChanges().discard();
              if (pendingView) setView(pendingView);
              setPendingView(null);
            }}>{t("admin.leaveDiscard")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
