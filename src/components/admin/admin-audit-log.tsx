"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RecordList } from "@/components/ui/record-list";
import { ListRow, ListSection } from "@/components/ui/list";
import { useAdminAudit, type AdminAuditEntry } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";

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

/**
 * One recorded action, in the two lines it takes to say it.
 *
 * What was done and when is the first line; who did it and to what is the
 * second. As four columns it became four labelled fields stacked on top of one
 * another on every screen narrower than a desktop, and a cut-off target
 * identifier on the desktop.
 */
export function AdminAuditLog() {
  const { t } = useI18n();
  const state = useAdminAudit();
  const [selected, setSelected] = React.useState<AdminAuditEntry | null>(null);
  const actionLabel = (entry: AdminAuditEntry) =>
    ACTION_LABELS[entry.action] ? t(ACTION_LABELS[entry.action]) : entry.action;

  return (
    <>
      <RecordList
        count={state.entries.length}
        emptyLabel={t("ui.adminConsole.noAudit")}
        error={state.error}
        hasMore={state.hasMore}
        loading={state.loading}
        onPageChange={(page) => void state.changePage(page)}
        onQueryChange={state.setQuery}
        onSearch={() => void state.load(state.query)}
        page={state.page}
        query={state.query}
        searchPlaceholder={t("ui.adminConsole.auditSearchPlaceholder")}
      >
        <div className="rule-list px-[var(--row-gutter)]">
          {state.entries.map((entry) => (
            <button
              className="t-row flex w-full min-w-0 flex-col gap-0.5 py-[var(--row-padding-block)] text-left"
              data-selected={selected?.id === entry.id}
              key={entry.id}
              onClick={() => setSelected(entry)}
              type="button"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="truncate text-sm font-medium">{actionLabel(entry)}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                  {formatDate(entry.createdAt)}
                </span>
              </span>
              <span className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground">
                <span className="shrink-0">{entry.actorName}</span>
                {entry.targetId ? (
                  <span className="ml-auto truncate font-mono">{entry.targetId}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      </RecordList>
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
