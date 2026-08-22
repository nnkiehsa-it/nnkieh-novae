"use client";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ErrorState } from "@/components/ui/page-state";
import { useAdminAudit, type AdminAuditEntry } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";

function actionLabel(action: string, t: (key: string) => string) {
  const labels: Record<string, string> = {
    setUserRestriction: "ui.adminConsole.actionSetRestriction",
    setUserAccessScope: "ui.adminConsole.actionSetAccess",
    saveCategoryManagement: "ui.adminConsole.actionSaveCategories",
    savePlatformSettings: "ui.adminConsole.actionSaveSettings",
    savePlatformFeatures: "ui.adminConsole.actionSaveFeatures",
    moderateIssueStatus: "ui.adminConsole.actionModerateIssue",
    updateIssueResult: "ui.adminConsole.actionUpdateIssue",
    updateFacilityStatus: "ui.adminConsole.actionUpdateFacility",
    createAnnouncement: "ui.adminConsole.actionCreateAnnouncement",
    deleteAnnouncement: "ui.adminConsole.actionDeleteAnnouncement",
    deleteIssue: "ui.adminConsole.actionDeleteIssue",
    deleteFacility: "ui.adminConsole.actionDeleteFacility",
  };
  return labels[action] ? t(labels[action]) : action;
}

function detailSummary(entry: AdminAuditEntry) {
  return Object.entries(entry.detail)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" · ") || "—";
}

export function AdminAuditLog() {
  const { t } = useI18n();
  const { entries, error, load, loading, query, setQuery } = useAdminAudit();

  if (error && entries.length === 0) {
    return <ErrorState error={error} onRetry={() => void load(query)} />;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Audit log</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("ui.adminConsole.auditDescription")}
        </p>
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void load(query);
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("ui.adminConsole.auditSearchPlaceholder")}
            value={query}
          />
        </div>
        <Button disabled={loading} type="submit" variant="secondary">
          {loading ? <LoadingSpinner /> : t("ui.common.search")}
        </Button>
      </form>

      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="hidden grid-cols-[9rem_10rem_11rem_minmax(10rem,1fr)_minmax(12rem,1.2fr)] gap-3 border-b bg-muted/35 px-4 py-2.5 text-xs font-medium text-muted-foreground md:grid">
          <span>{t("ui.adminConsole.timeColumn")}</span>
          <span>{t("ui.adminConsole.adminColumn")}</span>
          <span>{t("ui.adminConsole.actionColumn")}</span>
          <span>{t("ui.adminConsole.targetColumn")}</span>
          <span>{t("ui.adminConsole.detailColumn")}</span>
        </div>
        {entries.length === 0 && !loading ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            {t("ui.adminConsole.noAudit")}
          </div>
        ) : (
          <div className="divide-y">
            {entries.map((entry) => (
              <div
                className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[9rem_10rem_11rem_minmax(10rem,1fr)_minmax(12rem,1.2fr)] md:gap-3"
                key={entry.id}
              >
                <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                <span className="truncate">{entry.actorName}</span>
                <span className="truncate font-medium">{actionLabel(entry.action, t)}</span>
                <span className="truncate text-muted-foreground">{entry.targetId ?? "—"}</span>
                <span className="truncate text-xs text-muted-foreground">{detailSummary(entry)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
