"use client";

import type { OperationsConsole } from "@/hooks/use-system-console";
import { useI18n } from "@/i18n";
import { ListGroup, ListRow } from "@/ui/list";
import { LoadingList } from "@/ui/page";
import { DetailRow } from "../shared/rows";

const SHOWN_TABLES = 6;
const SHOWN_BUCKETS = 5;

const mebibytes = (value: number) => `${(value / 1_048_576).toFixed(1)} MiB`;

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

  return (
    <div className="grid gap-6">
      {databaseBytes === undefined || !metrics ? <LoadingList label={t("common.loading")} rows={3} /> : (
        <ListGroup title={t("ui.operations.storage")}>
          <ListRow label={t("ui.operations.storage")} value={mebibytes(databaseBytes)} />
          {metrics.slice(0, SHOWN_BUCKETS).map((row) => (
            <ListRow key={row.bucket} label={row.bucket} value={mebibytes(row.databaseBytes)} />
          ))}
        </ListGroup>
      )}
      {ranked ? (
        <ListGroup title={t("ui.operations.table")}>
          {ranked.slice(0, SHOWN_TABLES).map((row) => <TableRow key={row.name} row={row} />)}
          {ranked.length > SHOWN_TABLES ? (
            <DetailRow label={t("admin.showAllTables", { count: ranked.length })} title={t("ui.operations.table")}>
              <ListGroup>
                {ranked.map((row) => <TableRow key={row.name} row={row} />)}
              </ListGroup>
            </DetailRow>
          ) : null}
        </ListGroup>
      ) : <LoadingList label={t("common.loading")} rows={4} />}
    </div>
  );
}
