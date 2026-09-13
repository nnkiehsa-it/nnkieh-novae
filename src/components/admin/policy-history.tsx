"use client";

import * as React from "react";

import { useI18n } from "@/i18n";
import { ListRow, ListSection } from "@/components/ui/list";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { OperationPolicyKey } from "@/generated/operations";
import type { OperationsConsole } from "@/hooks/use-operation-policies";

/** What was changed, by whom, and why -- one revision at a time. */
export function PolicyHistory({ entries }: { entries: OperationsConsole["history"] }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = React.useState("");
  if (entries.length === 0)
    return (
      <ListSection header={t("ui.operations.history")}>
        <ListRow detail={t("ui.operations.empty")} label={t("ui.operations.history")} />
      </ListSection>
    );
  return (
    <ListSection header={t("ui.operations.history")}>
      {entries.map((entry) => {
        const open = expanded === String(entry.id);
        const changed = (Object.keys(entry.afterValue) as OperationPolicyKey[]).filter(
          (key) => entry.beforeValue[key] !== entry.afterValue[key],
        );
        return (
          <div className="py-1" key={entry.id}>
            <button
              aria-expanded={open}
              className="flex w-full items-center gap-3 py-2 text-left"
              onClick={() => setExpanded(open ? "" : String(entry.id))}
              type="button"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] leading-6">{entry.reason}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  {t("admin.policyRevision", { revision: entry.revision })} ·{" "}
                  {formatDate(new Date(entry.createdAt))}
                </span>
              </span>
              <Button aria-hidden size="sm" tabIndex={-1} variant="ghost">
                {t(open ? "admin.policyHide" : "admin.policyChangedCount", {
                  count: changed.length,
                })}
              </Button>
            </button>
            {open ? (
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
            ) : null}
          </div>
        );
      })}
    </ListSection>
  );
}
