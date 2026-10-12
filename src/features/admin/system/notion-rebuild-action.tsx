"use client";

import * as React from "react";
import { Database } from "@phosphor-icons/react/ssr";
import type { OperationsConsole } from "@/hooks/use-system-console";
import { useI18n } from "@/i18n";
import { ConfirmDialog } from "@/ui/confirm-dialog";
import { ListGroup } from "@/ui/list";
import { IconAction } from "../shared/icon-actions";
import { JobProgressRow, jobPercent } from "../shared/job-progress-row";
import { ActionableRow } from "../shared/rows";
import { statusLabel } from "./failures";

/**
 * Asking for the whole archive to be written again, and watching it happen.
 * While a rebuild runs the row stops being a control and becomes the reading,
 * since it outlasts the screen it was queued from.
 */
export function NotionRebuildAction({ busy, disabled, job, onRebuild }: {
  busy: boolean;
  disabled: boolean;
  job: OperationsConsole["jobs"][number] | null;
  onRebuild: () => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  return (
    <ListGroup title={t("ui.operations.notionArchive")}>
      {job ? (
        <JobProgressRow
          detail={t("admin.jobProgress", { estimated: job.estimatedRows, processed: job.processedRows, status: statusLabel(t, job.status) })}
          label={t("ui.operations.notionRebuild")}
          percent={jobPercent(job)}
        />
      ) : (
        <ActionableRow
          action={<IconAction busy={busy} disabled={disabled} icon={<Database />} label={t("ui.operations.notionRebuildAction")} onClick={() => setOpen(true)} />}
          label={t("ui.operations.notionRebuild")}
          onClick={() => setOpen(true)}
        />
      )}
      <ConfirmDialog
        confirmLabel={t("ui.operations.notionRebuildAction")}
        description={t("ui.operations.notionRebuildConfirm")}
        onConfirm={() => { setOpen(false); onRebuild(); }}
        onOpenChange={setOpen}
        open={open}
        title={t("ui.operations.notionRebuildTitle")}
      />
    </ListGroup>
  );
}
