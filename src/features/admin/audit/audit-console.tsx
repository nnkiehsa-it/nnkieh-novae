"use client";

import { useAdminView } from "@/hooks/use-admin-view";
import { useI18n } from "@/i18n";
import { SectionTabs } from "../shared/section-tabs";
import { ActivityFeed } from "./activity-feed";
import { AuditLog } from "./audit-log";

const VIEWS = ["actions", "activity"] as const;

/** What has happened: the actions administrators took, and what the platform itself recorded. */
export function AuditConsole() {
  const { t } = useI18n();
  const [view, setView] = useAdminView(VIEWS);
  return (
    <div className="grid gap-6">
      <SectionTabs
        label={t("admin.auditTitle")}
        onChange={setView}
        sections={[
          { detail: t("admin.summary.actions"), label: t("admin.auditActions"), value: "actions" },
          { detail: t("admin.summary.activity"), label: t("admin.auditActivity"), value: "activity" },
        ]}
        value={view}
      />
      {view === "actions" ? <AuditLog /> : <ActivityFeed />}
    </div>
  );
}
