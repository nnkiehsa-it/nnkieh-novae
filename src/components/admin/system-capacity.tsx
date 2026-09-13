"use client";

import * as React from "react";

import { useI18n } from "@/i18n";
import type { OperationsConsole } from "@/hooks/use-system-console";
import { ListRow, ListSection } from "@/components/ui/list";
import { Button } from "@/components/ui/button";

function mebibytes(value: number) {
  return `${(value / 1_048_576).toFixed(1)} MiB`;
}

/** How much room the database is taking, and where it is going. */
export function SystemCapacity({ snapshot }: { snapshot: OperationsConsole }) {
  const { t } = useI18n();
  const [showAll, setShowAll] = React.useState(false);
  const ranked = snapshot.capacity.toSorted((left, right) => right.totalBytes - left.totalBytes);
  const shown = showAll ? ranked : ranked.slice(0, 6);

  return (
    <div className="space-y-6">
      <ListSection footer={t("ui.operations.storageHelp")} header={t("ui.operations.storage")}>
        <ListRow
          label={t("ui.operations.storage")}
          value={mebibytes(snapshot.databaseBytes)}
        />
        {snapshot.metrics.slice(0, 5).map((row) => (
          <ListRow
            key={row.bucket}
            label={row.bucket.slice(0, 10)}
            value={mebibytes(row.databaseBytes)}
          />
        ))}
      </ListSection>

      <ListSection
        header={t("ui.operations.table")}
        headerAction={
          ranked.length > 6 ? (
            <Button onClick={() => setShowAll(!showAll)} size="sm" variant="ghost">
              {t(showAll ? "admin.policyHide" : "admin.showAllTables", { count: ranked.length })}
            </Button>
          ) : null
        }
      >
        {shown.map((row) => (
          <ListRow
            detail={t("admin.tableRows", { dead: row.deadRows, rows: row.rows })}
            key={row.name}
            label={<span className="font-mono text-sm">{row.name}</span>}
            value={mebibytes(row.totalBytes)}
          />
        ))}
      </ListSection>
    </div>
  );
}
