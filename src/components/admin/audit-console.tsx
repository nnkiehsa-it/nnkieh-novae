"use client";

import { useAdminView } from "@/hooks/use-admin-view";

import { useI18n } from "@/i18n";
import { AdminAuditLog } from "@/components/admin/admin-audit-log";
import { AdminActivityFeed } from "@/components/admin/admin-activity-feed";
import { AdminAreaNavigation } from "@/components/admin/admin-area-navigation";
import { ContentTransition, StateTransition } from "@/components/motion/state-transition";

/**
 * What has happened: the actions administrators took, and what the platform
 * itself recorded. The second used to be reachable only through a dialog on a
 * screen that no longer exists.
 */
export function AuditConsole() {
  const { t } = useI18n();
  const [view, setView] = useAdminView(["overview", "actions", "activity"] as const);
  return (
    <div className="space-y-6">
      <AdminAreaNavigation
        onSelect={setView}
        areas={[
          { label: t("admin.auditActions"), value: "actions", detail: t("admin.summary.actions") },
          { label: t("admin.auditActivity"), value: "activity", detail: t("admin.summary.activity") },
        ]}
        value={view}
      />
      {view !== "overview" ? <StateTransition className="min-w-0" data-admin-content identity={view}>
        <ContentTransition identity={view}>
          {view === "actions" ? <AdminAuditLog /> : <AdminActivityFeed />}
        </ContentTransition>
      </StateTransition> : null}
    </div>
  );
}
