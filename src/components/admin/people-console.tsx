"use client";

import * as React from "react";

import { useI18n } from "@/i18n";
import { AccessManagement } from "@/components/admin/access-management";
import { UserManagement } from "@/components/admin/user-management";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ContentTransition, StateTransition } from "@/components/motion/state-transition";

/**
 * Accounts and category responsibility are two readings of one relationship, so
 * they share a screen: by person, or by the area being managed.
 */
export function PeopleConsole() {
  const { t } = useI18n();
  const [view, setView] = React.useState("accounts");
  return (
    <div className="space-y-6">
      <LiquidTabs
        ariaLabel={t("admin.peopleTitle")}
        onValueChange={setView}
        options={[
          { label: t("admin.peopleByAccount"), value: "accounts" },
          { label: t("admin.peopleByScope"), value: "scopes" },
        ]}
        value={view}
      />
      <StateTransition className="min-w-0" data-admin-content identity={view}>
        <ContentTransition identity={view}>
          {view === "accounts" ? <UserManagement /> : <AccessManagement />}
        </ContentTransition>
      </StateTransition>
    </div>
  );
}
