"use client";

import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";

import { usePlatformJobs } from "@/hooks/use-platform-jobs";
import { useI18n } from "@/i18n";

function progress(job: { estimatedRows: number; processedRows: number; status: string }) {
  if (job.status === "completed") return 100;
  if (job.estimatedRows === 0) return 0;
  return Math.min(99, Math.round((job.processedRows / job.estimatedRows) * 100));
}

export function PlatformJobProgress() {
  const { t } = useI18n();
  const { entries, error } = usePlatformJobs();
  const visible = entries.filter((entry) => entry.status !== "superseded").slice(0, 5);
  if (visible.length === 0 && !error) return null;

  return (
    <section className="space-y-3" aria-live="polite">
      <div>
        <h3 className="text-sm font-semibold">{t("ui.admin.backgroundChanges")}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("ui.admin.backgroundChangesHelp")}
        </p>
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">
        {error ? (
          <p className="px-4 py-3 text-sm text-destructive">{error}</p>
        ) : visible.map((job) => {
          const percent = progress(job);
          const Icon = job.status === "failed"
            ? AlertTriangle
            : job.status === "completed"
              ? CheckCircle2
              : LoaderCircle;
          return (
            <div className="space-y-2.5 border-b px-4 py-3 last:border-b-0" key={job.id}>
              <div className="flex items-center gap-3">
                <Icon className={job.status === "processing" ? "size-4 animate-spin" : "size-4"} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {job.jobType === "announcement-comments"
                      ? t("ui.admin.announcementCommentPolicy")
                      : job.jobType === "retention-cleanup"
                        ? t("ui.admin.retentionCleanupJob")
                      : t("ui.admin.issueCommentPolicy", { scope: job.scopeId })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {job.status === "failed"
                      ? t("ui.admin.backgroundFailed", { traceId: job.errorTraceId ?? "—" })
                      : job.status === "completed"
                      ? t("ui.admin.backgroundResult", { count: job.affectedRows })
                      : t("ui.admin.backgroundProgress", {
                        estimated: job.estimatedRows,
                        processed: job.processedRows,
                      })}
                  </p>
                </div>
                <span className="font-mono text-xs tabular-nums">{percent}%</span>
              </div>
              <div
                aria-label={t("ui.admin.backgroundProgressLabel")}
                aria-valuemax={100}
                aria-valuemin={0}
                aria-valuenow={percent}
                className="h-1.5 overflow-hidden rounded-full bg-muted"
                role="progressbar"
              >
                <div
                  className="h-full origin-left rounded-full bg-primary transition-transform duration-500"
                  style={{ transform: `scaleX(${percent / 100})` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
