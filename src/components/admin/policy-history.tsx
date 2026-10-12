"use client";

import { useI18n } from "@/i18n";
import { SheetRow } from "@/components/ui/sheet-row";
import { ListRow, ListSection } from "@/components/ui/list";
import { formatDate } from "@/lib/format";
import type { OperationPolicyKey } from "@/generated/operations";
import type { OperationsConsole } from "@/hooks/use-operation-policies";

/** What was changed, by whom, and why -- one revision at a time. */
export function PolicyHistory({ entries, showHeader = true }: {
  entries: OperationsConsole["history"];
  showHeader?: boolean;
}) {
  const { t } = useI18n();
  const header = showHeader ? t("ui.operations.history") : undefined;
  if (entries.length === 0)
    return (
      <ListSection header={header}>
        <ListRow label={t("ui.operations.empty")} />
      </ListSection>
    );
  return (
    <ListSection header={header}>
      {entries.map((entry) => {
        const changed = (Object.keys(entry.afterValue) as OperationPolicyKey[]).filter(
          (key) => entry.beforeValue[key] !== entry.afterValue[key],
        );
        return (
          <SheetRow
            key={entry.id}
            label={
              <>
                <span className="block">{entry.reason}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("admin.policyRevision", { revision: entry.revision })} ·{" "}
                  {formatDate(new Date(entry.createdAt))}
                </span>
              </>
            }
            title={entry.reason}
            value={t("admin.policyChangedCount", { count: changed.length })}
          >
            <ListSection
              header={`${t("admin.policyRevision", { revision: entry.revision })} · ${formatDate(new Date(entry.createdAt))}`}
            >
              {changed.map((key) => (
                <ListRow
                  key={key}
                  label={t(`ui.operations.policy.${key}`)}
                  value={
                    <span className="tabular-nums">
                      {entry.beforeValue[key]}
                      <span aria-hidden className="px-1.5">
                        →
                      </span>
                      <span className="font-medium text-foreground">{entry.afterValue[key]}</span>
                    </span>
                  }
                />
              ))}
            </ListSection>
          </SheetRow>
        );
      })}
    </ListSection>
  );
}
