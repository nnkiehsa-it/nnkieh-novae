"use client";

import * as React from "react";

import { useI18n } from "@/i18n";
import { AdminAuditLog } from "@/components/admin/admin-audit-log";
import { AdminActivityFeed } from "@/components/admin/admin-activity-feed";
import { LiquidTabs } from "@/components/ui/liquid-tabs";
import { ContentTransition, StateTransition } from "@/components/motion/state-transition";

/**
 * What has happened: the actions administrators took, and what the platform
 * itself recorded. The second used to be reachable only through a dialog on a
 * screen that no longer exists.
 */
export function AuditConsole() {
  const { t } = useI18n();
  const [view, setView] = React.useState("actions");
  return (
    <div className="space-y-6">
      <LiquidTabs
        ariaLabel={t("admin.auditTitle")}
        onValueChange={setView}
        options={[
          { label: t("admin.auditActions"), value: "actions" },
          { label: t("admin.auditActivity"), value: "activity" },
        ]}
        value={view}
      />
      <StateTransition className="min-w-0" data-admin-content identity={view}>
        <ContentTransition identity={view}>
          {view === "actions" ? <AdminAuditLog /> : <AdminActivityFeed />}
        </ContentTransition>
      </StateTransition>
    </div>
  );
}
