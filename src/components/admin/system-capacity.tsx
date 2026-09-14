"use client";

import { useI18n } from "@/i18n";
import type { OperationsConsole } from "@/hooks/use-system-console";
import { Disclosure } from "@/components/ui/disclosure";
import { AdminListSkeleton } from "@/components/admin/admin-list-skeleton";
import { ListRow, ListSection } from "@/components/ui/list";

function mebibytes(value: number) {
  return `${(value / 1_048_576).toFixed(1)} MiB`;
}

function TableRow({ row }: { row: OperationsConsole["capacity"][number] }) {
  const { t } = useI18n();
  return (
    <ListRow
      detail={t("admin.tableRows", { dead: row.deadRows, rows: row.rows })}
      label={<span className="font-mono text-sm">{row.name}</span>}
      value={mebibytes(row.totalBytes)}
    />
  );
}

/** How much room the database is taking, and where it is going. */
export function SystemCapacity({ snapshot }: { snapshot: Partial<OperationsConsole> }) {
  const { t } = useI18n();
  const { capacity, databaseBytes, metrics } = snapshot;
  const ranked = capacity?.toSorted((left, right) => right.totalBytes - left.totalBytes);
  const shown = ranked?.slice(0, 6) ?? [];
  const rest = ranked?.slice(6) ?? [];

  return (
    <div className="space-y-6">
      {databaseBytes === undefined || !metrics ? <AdminListSkeleton groups={1} rows={3} /> : (
      <ListSection header={t("ui.operations.storage")}>
        <ListRow
          label={t("ui.operations.storage")}
          value={mebibytes(databaseBytes)}
        />
        {metrics.slice(0, 5).map((row) => (
          <ListRow
            key={row.bucket}
            label={row.bucket.slice(0, 10)}
            value={mebibytes(row.databaseBytes)}
          />
        ))}
      </ListSection>
      )}

      {ranked ? (
      <ListSection header={t("ui.operations.table")}>
        {shown.map((row) => (
          <TableRow key={row.name} row={row} />
        ))}
        {rest.length > 0 ? (
          <Disclosure label={t("admin.showAllTables", { count: ranked.length })}>
            <div className="rule-list">
              {rest.map((row) => (
                <TableRow key={row.name} row={row} />
              ))}
            </div>
          </Disclosure>
        ) : null}
      </ListSection>
      ) : <AdminListSkeleton groups={1} rows={4} />}
    </div>
  );
}
