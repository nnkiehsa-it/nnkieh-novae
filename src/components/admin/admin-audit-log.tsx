"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataList } from "@/components/ui/data-list";
import { ListRow, ListSection } from "@/components/ui/list";
import { useAdminAudit, type AdminAuditEntry } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";

const GRID = "9rem 10rem 11rem minmax(10rem,1fr)";

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

export function AdminAuditLog() {
  const { t } = useI18n();
  const state = useAdminAudit();
  const [selected, setSelected] = React.useState<AdminAuditEntry | null>(null);
  const actionLabel = (entry: AdminAuditEntry) =>
    ACTION_LABELS[entry.action] ? t(ACTION_LABELS[entry.action]) : entry.action;

  return (
    <>
      <DataList<AdminAuditEntry>
        columns={[
          { key: "time", label: t("ui.adminConsole.timeColumn") },
          { key: "actor", label: t("ui.adminConsole.adminColumn") },
          { key: "action", label: t("ui.adminConsole.actionColumn") },
          { key: "target", label: t("ui.adminConsole.targetColumn") },
        ]}
        emptyLabel={t("ui.adminConsole.noAudit")}
        error={state.error}
        grid={GRID}
        hasMore={state.hasMore}
        loading={state.loading}
        onPageChange={(page) => void state.changePage(page)}
        onQueryChange={state.setQuery}
        onRowSelect={setSelected}
        onSearch={() => void state.load(state.query)}
        page={state.page}
        query={state.query}
        renderCell={(entry, key) => {
          if (key === "time")
            return <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>;
          if (key === "actor") return entry.actorName;
          if (key === "action") return <span className="font-medium">{actionLabel(entry)}</span>;
          return <span className="text-muted-foreground">{entry.targetId ?? "—"}</span>;
        }}
        rowKey={(entry) => String(entry.id)}
        rows={state.entries}
        searchPlaceholder={t("ui.adminConsole.auditSearchPlaceholder")}
      />
      <AuditEntrySheet
        actionLabel={actionLabel}
        entry={selected}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

/**
 * What one recorded action actually says.
 *
 * The record used to be flattened into the first three of its fields, joined by
 * a separator and cut off inside a column; the whole of it opens here instead.
 */
function AuditEntrySheet({
  actionLabel,
  entry,
  onClose,
}: {
  actionLabel: (entry: AdminAuditEntry) => string;
  entry: AdminAuditEntry | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [shown, setShown] = React.useState<AdminAuditEntry | null>(entry);
  if (entry && entry !== shown) setShown(entry);
  const record = entry ?? shown;
  if (!record) return null;
  const fields = Object.entries(record.detail).filter(
    ([, value]) => value !== null && value !== undefined && value !== "",
  );

  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open={Boolean(entry)}>
      <DialogContent className="sm:max-w-xl" presentation="sheet">
        <DialogHeader>
          <DialogTitle>{actionLabel(record)}</DialogTitle>
          <DialogDescription>{formatDate(record.createdAt)}</DialogDescription>
        </DialogHeader>
        <ListSection>
          <ListRow label={t("ui.adminConsole.adminColumn")} value={record.actorName} />
          <ListRow
            label={t("ui.adminConsole.targetColumn")}
            value={<span className="font-mono text-xs">{record.targetId ?? "—"}</span>}
          />
        </ListSection>
        <ListSection header={t("ui.adminConsole.detailColumn")}>
          {fields.length === 0 ? (
            <ListRow label="—" />
          ) : (
            fields.map(([key, value]) => (
              <ListRow
                key={key}
                label={<span className="font-mono text-xs">{key}</span>}
                value={<span className="break-all">{String(value)}</span>}
              />
            ))
          )}
        </ListSection>
      </DialogContent>
    </Dialog>
  );
}
