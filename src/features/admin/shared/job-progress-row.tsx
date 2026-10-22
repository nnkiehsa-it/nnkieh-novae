import * as React from "react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";
import { rowClass } from "@/ui/list";
import { ProgressBar } from "@/ui/feedback";

/** How far a background job has got, never claiming completion before it reports it. */
export function jobPercent(job: { estimatedRows: number; processedRows: number; status: string }) {
  if (job.status === "completed") return 100;
  if (job.estimatedRows === 0) return 0;
  return Math.min(99, Math.round((job.processedRows / job.estimatedRows) * 100));
}

/** One piece of background work as a list row with its progress drawn underneath. */
export function JobProgressRow({ detail, icon, label, percent }: {
  detail: React.ReactNode;
  icon?: React.ReactNode;
  label: React.ReactNode;
  percent: number;
}) {
  const { t } = useI18n();
  return (
    <li className={cn(rowClass, "flex-col items-stretch gap-3")}>
      <div className="flex items-center gap-3">
        {icon ? <span aria-hidden className="shrink-0 [&_svg]:size-5">{icon}</span> : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base">{label}</p>
          <p className="text-sm text-ink-muted">{detail}</p>
        </div>
        <span className="text-sm tabular-nums text-ink-muted">{percent}%</span>
      </div>
      <ProgressBar label={t("ui.admin.backgroundProgressLabel")} value={percent / 100} />
    </li>
  );
}
