"use client";

import { useI18n } from "@/i18n";
import { Disclosure } from "@/components/ui/disclosure";
import { ListRow, ListSection } from "@/components/ui/list";
import { formatDate } from "@/lib/format";
import type { OperationPolicyKey } from "@/generated/operations";
import type { OperationsConsole } from "@/hooks/use-operation-policies";

/** What was changed, by whom, and why -- one revision at a time. */
export function PolicyHistory({ entries }: { entries: OperationsConsole["history"] }) {
  const { t } = useI18n();
  if (entries.length === 0)
    return (
      <ListSection header={t("ui.operations.history")}>
        <ListRow label={t("ui.operations.empty")} />
      </ListSection>
    );
  return (
    <ListSection header={t("ui.operations.history")}>
      {entries.map((entry) => {
        const changed = (Object.keys(entry.afterValue) as OperationPolicyKey[]).filter(
          (key) => entry.beforeValue[key] !== entry.afterValue[key],
        );
        return (
          <Disclosure
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
            value={t("admin.policyChangedCount", { count: changed.length })}
          >
            <div className="pb-2">
              {changed.map((key) => (
                <p className="flex gap-3 py-1 text-sm" key={key}>
                  <span className="min-w-0 flex-1">{t(`ui.operations.policy.${key}`)}</span>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {entry.beforeValue[key]}
                    <span aria-hidden className="px-1.5">
                      →
                    </span>
                    <span className="font-medium text-foreground">{entry.afterValue[key]}</span>
                  </span>
                </p>
              ))}
            </div>
          </Disclosure>
        );
      })}
    </ListSection>
  );
}
