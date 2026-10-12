"use client";

import type { AdminAuditEntry } from "@/hooks/use-admin-console";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { ListGroup } from "@/ui/list";
import { Sheet } from "@/ui/sheet";
import { FieldRow } from "../shared/rows";
import { useRetained } from "../shared/use-retained";
import { AuditDetails } from "./audit-details";

/** What one recorded action actually says, in full rather than as the first few fields of it. */
export function AuditEntrySheet({ actionLabel, entry, onClose }: {
  actionLabel: (entry: AdminAuditEntry) => string;
  entry: AdminAuditEntry | null;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const record = useRetained(entry);
  if (!record) return null;

  return (
    <Sheet
      description={formatDate(record.createdAt)}
      onOpenChange={(open) => { if (!open) onClose(); }}
      open={entry !== null}
      title={actionLabel(record)}
    >
      <div className="grid gap-6">
        <ListGroup>
          <FieldRow label={t("ui.adminConsole.adminColumn")} value={record.actorName} />
          <FieldRow label={t("ui.adminConsole.targetColumn")} mono value={record.targetId ?? "—"} />
        </ListGroup>
        <ListGroup title={t("ui.adminConsole.detailColumn")}>
          {Object.keys(record.detail).length === 0 ? <FieldRow label="—" value="" /> : <AuditDetails detail={record.detail} />}
        </ListGroup>
      </div>
    </Sheet>
  );
}
