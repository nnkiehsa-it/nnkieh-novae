import { CheckCircle, WarningCircle } from "@phosphor-icons/react/ssr";
import { AnimatePresence } from "motion/react";
import { usePlatformJobs } from "@/hooks/use-platform-jobs";
import { useI18n } from "@/i18n";
import { Spinner } from "@/ui/feedback";
import { ListGroup, ListRow } from "@/ui/list";
import { JobProgressRow, jobPercent } from "../shared/job-progress-row";
import { Reveal } from "../shared/reveal";
import type { Translate } from "../shared/translate";

type Job = ReturnType<typeof usePlatformJobs>["entries"][number];

const MAX_SHOWN = 5;

function labelOf(job: Job, t: Translate) {
  if (job.jobType === "announcement-comments") return t("ui.admin.announcementCommentPolicy");
  if (job.jobType === "retention-cleanup") return t("ui.admin.retentionCleanupJob");
  return t("ui.admin.issueCommentPolicy", { scope: job.scopeId });
}

function detailOf(job: Job, t: Translate) {
  if (job.status === "failed") return t("ui.admin.backgroundFailed", { traceId: job.failureId ?? "—" });
  if (job.status === "completed") return t("ui.admin.backgroundResult", { count: job.affectedRows });
  return t("ui.admin.backgroundProgress", { estimated: job.estimatedRows, processed: job.processedRows });
}

function JobIcon({ status }: { status: Job["status"] }) {
  if (status === "failed") return <WarningCircle className="text-danger" />;
  if (status === "completed") return <CheckCircle className="text-positive" />;
  return <Spinner />;
}

/**
 * What a save is still doing after the save finished. Some settings changes
 * hand work to the background, and that work outlives the screen that queued
 * it, so this belongs to the administration area and shows on whichever
 * screen the reader moves to next.
 */
export function ApplyProgress() {
  const { t } = useI18n();
  const { entries, error } = usePlatformJobs();
  const jobs = entries.filter((entry) => entry.status !== "superseded").slice(0, MAX_SHOWN);

  return (
    <AnimatePresence initial={false}>
      {jobs.length > 0 || error ? (
        <Reveal>
          <div aria-live="polite">
            <ListGroup title={t("ui.admin.backgroundChanges")}>
              {error ? (
                <ListRow label={<span className="text-danger">{error}</span>} />
              ) : (
                jobs.map((job) => (
                  <JobProgressRow
                    detail={detailOf(job, t)}
                    icon={<JobIcon status={job.status} />}
                    key={job.id}
                    label={labelOf(job, t)}
                    percent={jobPercent(job)}
                  />
                ))
              )}
            </ListGroup>
          </div>
        </Reveal>
      ) : null}
    </AnimatePresence>
  );
}
