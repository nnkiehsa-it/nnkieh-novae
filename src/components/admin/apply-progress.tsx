"use client";

import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { usePlatformJobs } from "@/hooks/use-platform-jobs";
import { useI18n } from "@/i18n";
import { timing } from "@/lib/motion-timing";
import { ListCustomRow, ListSection } from "@/components/ui/list";

function percentOf(job: { estimatedRows: number; processedRows: number; status: string }) {
  if (job.status === "completed") return 100;
  if (job.estimatedRows === 0) return 0;
  return Math.min(99, Math.round((job.processedRows / job.estimatedRows) * 100));
}

/**
 * What a save is still doing after the save finished.
 *
 * Some settings changes hand work to the background, and that work outlives the
 * screen that queued it -- so this lives in the administration shell and shows
 * on whichever administration screen the reader moves to next.
 *
 * It rises into the screen when there is background work and collapses back out
 * of it when there is none, because a panel that vanished between two frames
 * read as the page losing its place rather than as the work being finished.
 */
export function ApplyProgress() {
  const { t } = useI18n();
  const { entries, error } = usePlatformJobs();
  const visible = entries.filter((entry) => entry.status !== "superseded").slice(0, 5);

  return (
    <AnimatePresence initial={false}>
      {visible.length > 0 || error ? (
    <motion.div
      animate={{ height: "auto", opacity: 1 }}
      aria-live="polite"
      className="mx-auto w-full max-w-4xl overflow-hidden"
      exit={{ height: 0, opacity: 0 }}
      initial={{ height: 0, opacity: 0 }}
      transition={timing("control")}
    >
      <div className="mt-6">
      <ListSection
        header={t("ui.admin.backgroundChanges")}
      >
        {error ? (
          <ListCustomRow>
            <span className="text-sm text-destructive">{error}</span>
          </ListCustomRow>
        ) : (
          visible.map((job) => {
            const percent = percentOf(job);
            const Icon =
              job.status === "failed"
                ? AlertTriangle
                : job.status === "completed"
                  ? CheckCircle2
                  : LoaderCircle;
            return (
              <ListCustomRow className="!flex-col !items-stretch gap-2.5" key={job.id}>
                <div className="flex items-center gap-3">
                  <Icon
                    className={job.status === "processing" ? "size-4 animate-spin" : "size-4"}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9375rem] leading-6">
                      {job.jobType === "announcement-comments"
                        ? t("ui.admin.announcementCommentPolicy")
                        : job.jobType === "retention-cleanup"
                          ? t("ui.admin.retentionCleanupJob")
                          : t("ui.admin.issueCommentPolicy", { scope: job.scopeId })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {job.status === "failed"
                        ? t("ui.admin.backgroundFailed", { traceId: job.failureId ?? "—" })
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
                    className="h-full origin-left rounded-full bg-primary transition-transform duration-[var(--motion-sheet)]"
                    style={{ transform: `scaleX(${percent / 100})` }}
                  />
                </div>
              </ListCustomRow>
            );
          })
        )}
      </ListSection>
      </div>
    </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
