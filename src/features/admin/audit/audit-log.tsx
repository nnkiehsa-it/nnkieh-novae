import * as React from "react";
import { useAdminAudit, type AdminAuditEntry } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { ListRow } from "@/ui/list";
import { RecordBrowser } from "../shared/record-browser";
import { ACTION_LABELS } from "./audit-labels";
import { AuditEntrySheet } from "./audit-entry-sheet";

/**
 * Every recorded administrator action, in the two lines it takes to say it:
 * what was done and when, then who did it and to what. The whole record opens
 * in a sheet.
 */
export function AuditLog() {
  const { t } = useI18n();
  const state = useAdminAudit();
  const [selected, setSelected] = React.useState<AdminAuditEntry | null>(null);
  const actionLabel = (entry: AdminAuditEntry) => (ACTION_LABELS[entry.action] ? t(ACTION_LABELS[entry.action]) : entry.action);

  return (
    <>
      <RecordBrowser
        count={state.entries.length}
        emptyLabel={t("ui.adminConsole.noAudit")}
        error={state.error}
        hasMore={state.hasMore}
        loading={state.loading}
        onPageChange={(page) => void state.changePage(page)}
        onQueryChange={state.setQuery}
        onReset={() => void state.resetSearch()}
        onSearch={() => void state.load(state.query)}
        page={state.page}
        query={state.query}
        searchLabel={t("ui.adminConsole.auditSearchPlaceholder")}
      >
        {state.entries.map((entry) => (
          <ListRow
            detail={[entry.actorName, entry.targetId].filter(Boolean).join(" · ")}
            key={entry.id}
            label={actionLabel(entry)}
            onClick={() => setSelected(entry)}
            value={formatDate(entry.createdAt)}
          />
        ))}
      </RecordBrowser>
      <AuditEntrySheet actionLabel={actionLabel} entry={selected} onClose={() => setSelected(null)} />
    </>
  );
}
