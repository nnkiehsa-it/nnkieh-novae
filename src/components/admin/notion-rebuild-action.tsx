"use client";

import * as React from "react";
import { DatabaseBackup } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ListMutationRow, ListSection, RowAction } from "@/components/ui/list";
import type { OperationsConsole } from "@/hooks/use-system-console";
import { useI18n } from "@/i18n";
import { statusLabel } from "@/components/admin/system-failures";

/**
 * Asking for the whole archive to be written again, and watching it happen.
 *
 * The request is a write, so it is the glyph that carries it rather than the
 * width of the row. While a rebuild is running the row stops being a control
 * and becomes the reading: how far through it is, refreshed on its own, because
 * this is the one piece of work an administrator queues here that takes longer
 * than the screen they queued it from.
 */
export function NotionRebuildAction({
  busy,
  job,
  onRebuild,
}: {
  busy: boolean;
  job: OperationsConsole["jobs"][number] | null;
  onRebuild: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const percent = job && job.estimatedRows > 0
    ? Math.min(99, Math.round((job.processedRows / job.estimatedRows) * 100))
    : 0;
  return (
    <>
      <ListSection header={t("ui.operations.notionArchive")}>
        <ListMutationRow
          action={
            <RowAction
              busy={busy}
              disabled={Boolean(job)}
              icon={DatabaseBackup}
              label={t("ui.operations.notionRebuildAction")}
              onClick={() => setOpen(true)}
            />
          }
          detail={job ? t("admin.jobProgress", {
            estimated: job.estimatedRows,
            processed: job.processedRows,
            status: statusLabel(t, job.status),
          }) : undefined}
          label={t("ui.operations.notionRebuild")}
          value={job ? `${percent}%` : undefined}
        />
      </ListSection>
      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ui.operations.notionRebuildTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("ui.operations.notionRebuildConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("ui.common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onRebuild}>{t("ui.operations.notionRebuildAction")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
