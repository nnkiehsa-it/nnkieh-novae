"use client";

import * as React from "react";
import { getUnsavedChanges, subscribeUnsavedChanges } from "@/hooks/unsaved-changes-store";
import { useAdminView } from "@/hooks/use-admin-view";

import { useI18n } from "@/i18n";
import { AccessManagement } from "@/components/admin/access-management";
import { UserManagement } from "@/components/admin/user-management";
import { AccountAccessRules } from "@/components/admin/account-access-rules";
import { AdminAreaNavigation, AdminAreaPanel } from "@/components/admin/admin-area-navigation";

/**
 * Accounts and category responsibility are two readings of one relationship, so
 * they share a screen: by person, or by the area being managed.
 */
export function PeopleConsole() {
  const { t } = useI18n();
  const [view, setView] = useAdminView(["overview", "accounts", "scopes", "restrictions"] as const);
  const unsaved = React.useSyncExternalStore(subscribeUnsavedChanges, getUnsavedChanges, getUnsavedChanges);
  return (
    <div className="space-y-6">
      <AdminAreaNavigation
        onSelect={setView}
        areas={[
          { label: t("admin.peopleByAccount"), value: "accounts", detail: t("admin.summary.accounts") },
          { label: t("admin.peopleByScope"), value: "scopes", detail: t("admin.summary.scopes") },
          { label: t("ui.accountAccess.rulesTab"), value: "restrictions", detail: t("admin.summary.restrictions") },
        ]}
        value={view}
      />
      {view === "overview" && unsaved.count > 0 ? <p className="text-sm text-[var(--tint-content)]" role="status">{t("admin.sectionChanges", { count: unsaved.count })}</p> : null}
      <div data-admin-content>
      <AdminAreaPanel active={view === "accounts"}><UserManagement /></AdminAreaPanel>
      <AdminAreaPanel active={view === "scopes"}><AccessManagement /></AdminAreaPanel>
      <AdminAreaPanel active={view === "restrictions"}><AccountAccessRules /></AdminAreaPanel>
      </div>
    </div>
  );
}
