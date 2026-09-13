"use client";

import { DataList } from "@/components/ui/data-list";
import { useAdminAudit, type AdminAuditEntry } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";

const GRID = "9rem 10rem 11rem minmax(10rem,1fr) minmax(12rem,1.2fr)";

const ACTION_LABELS: Record<string, string> = {
  createAnnouncement: "ui.adminConsole.actionCreateAnnouncement",
  deleteAnnouncement: "ui.adminConsole.actionDeleteAnnouncement",
  deleteFacility: "ui.adminConsole.actionDeleteFacility",
  deleteIssue: "ui.adminConsole.actionDeleteIssue",
  moderateIssueStatus: "ui.adminConsole.actionModerateIssue",
  saveCategoryManagement: "ui.adminConsole.actionSaveCategories",
  savePlatformFeatures: "ui.adminConsole.actionSaveFeatures",
  savePlatformSettings: "ui.adminConsole.actionSaveSettings",
  setUserAccessScope: "ui.adminConsole.actionSetAccess",
  setUserRestriction: "ui.adminConsole.actionSetRestriction",
  updateFacilityStatus: "ui.adminConsole.actionUpdateFacility",
  updateIssueResult: "ui.adminConsole.actionUpdateIssue",
};

function detailSummary(entry: AdminAuditEntry) {
  return (
    Object.entries(entry.detail)
      .filter(([, value]) => value !== null && value !== undefined && value !== "")
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" · ") || "—"
  );
}

export function AdminAuditLog() {
  const { t } = useI18n();
  const state = useAdminAudit();

  return (
    <DataList<AdminAuditEntry>
      columns={[
        { key: "time", label: t("ui.adminConsole.timeColumn") },
        { key: "actor", label: t("ui.adminConsole.adminColumn") },
        { key: "action", label: t("ui.adminConsole.actionColumn") },
        { key: "target", label: t("ui.adminConsole.targetColumn") },
        { key: "detail", label: t("ui.adminConsole.detailColumn") },
      ]}
      emptyLabel={t("ui.adminConsole.noAudit")}
      error={state.error}
      grid={GRID}
      hasMore={state.hasMore}
      loading={state.loading}
      onPageChange={(page) => void state.changePage(page)}
      onQueryChange={state.setQuery}
      onSearch={() => void state.load(state.query)}
      page={state.page}
      query={state.query}
      renderCell={(entry, key) => {
        if (key === "time")
          return <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>;
        if (key === "actor") return entry.actorName;
        if (key === "action")
          return (
            <span className="font-medium">
              {ACTION_LABELS[entry.action] ? t(ACTION_LABELS[entry.action]) : entry.action}
            </span>
          );
        if (key === "target")
          return <span className="text-muted-foreground">{entry.targetId ?? "—"}</span>;
        return <span className="text-xs text-muted-foreground">{detailSummary(entry)}</span>;
      }}
      rowKey={(entry) => String(entry.id)}
      rows={state.entries}
      searchPlaceholder={t("ui.adminConsole.auditSearchPlaceholder")}
    />
  );
}
