"use client";

import type { OperationPolicyKey } from "@/generated/operations";
import type { OperationsConsole } from "@/hooks/use-operation-policies";
import { useI18n } from "@/i18n";
import { formatDate } from "@/lib/format";
import { ListGroup, ListRow } from "@/ui/list";
import { DetailRow } from "../shared/rows";

/** What was changed, by whom, and why, one revision at a time. */
export function PolicyHistory({ entries }: { entries: OperationsConsole["history"] }) {
  const { t } = useI18n();
  if (entries.length === 0) {
    return (
      <ListGroup>
        <ListRow label={t("ui.operations.empty")} />
      </ListGroup>
    );
  }
  return (
    <ListGroup>
      {entries.map((entry) => {
        const changed = (Object.keys(entry.afterValue) as OperationPolicyKey[]).filter(
          (key) => entry.beforeValue[key] !== entry.afterValue[key],
        );
        const heading = `${t("admin.policyRevision", { revision: entry.revision })} · ${formatDate(new Date(entry.createdAt))}`;
        return (
          <DetailRow
            detail={heading}
            key={entry.id}
            label={entry.reason}
            title={entry.reason}
            value={t("admin.policyChangedCount", { count: changed.length })}
          >
            <ListGroup title={heading}>
              {changed.map((key) => (
                <ListRow
                  key={key}
                  label={t(`ui.operations.policy.${key}`)}
                  value={
                    <span className="tabular-nums">
                      {entry.beforeValue[key]}
                      <span aria-hidden className="px-1.5">→</span>
                      <span className="font-medium text-ink">{entry.afterValue[key]}</span>
                    </span>
                  }
                />
              ))}
            </ListGroup>
          </DetailRow>
        );
      })}
    </ListGroup>
  );
}
