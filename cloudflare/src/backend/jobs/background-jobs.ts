import type { AppDatabaseClient } from "../database/client.ts";
import { deleteCloudinaryAsset } from "../shared/cloudinary.ts";
import { markNotionPageDeleted, reconcileNotionPages } from "../shared/notion.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import { asRecord, asString } from "../shared/http.ts";

export interface BackgroundJobItem {
  id: string;
  job_type: string;
  scope_id: string;
  payload: Record<string, unknown>;
  status: string;
  attempt_count: number;
}

export async function processBackgroundJobs(database: AppDatabaseClient) {
  const log = createFunctionLogger("processBackgroundJobs");
  const { data, error } = await database.call("app_api", "claim_background_jobs", {
    requested_batch_size: 10,
  });
  if (error) throw error;
  const jobs = (data ?? []) as BackgroundJobItem[];

  for (const job of jobs) {
    const attemptId = crypto.randomUUID();
    try {
      let jobResult: Record<string, any> = { success: true };

      if (job.job_type === "deletion") {
        const payload = asRecord(job.payload);
        const cloudinaryPublicId = asString(payload.cloudinary_public_id);
        const notionPageId = asString(payload.notion_page_id);
        const targetType = asString(payload.target_type);
        const targetId = asString(payload.target_id);

        if (cloudinaryPublicId) {
          let isCurrentAvatar = false;
          if (targetType === "avatar") {
            const { data: profile } = await database
              .table("app_private", "user_profiles")
              .select("avatar_public_id")
              .eq("uid", targetId)
              .maybeSingle();
            isCurrentAvatar = profile?.avatar_public_id === cloudinaryPublicId;
          }
          if (!isCurrentAvatar) {
            await deleteCloudinaryAsset(cloudinaryPublicId);
          }
        }

        if (notionPageId) {
          await markNotionPageDeleted(notionPageId);
          await database
            .table("app_private", "notion_pages")
            .delete()
            .eq("target_type", targetType)
            .eq("target_id", targetId);
        }
      } else if (job.job_type === "notion_reconcile") {
        const reconcileRes = await reconcileNotionPages(database);
        jobResult = { ...jobResult, ...reconcileRes };
      } else if (job.job_type === "retention_cleanup") {
        const { data: cleanupRes, error: cleanupErr } = await database.call(
          "app_api",
          "run_scheduled_maintenance_cleanup",
        );
        if (cleanupErr) throw cleanupErr;
        jobResult = { ...jobResult, cleanup: cleanupRes };
      }

      await database.call("app_api", "complete_background_job", {
        job_id: job.id,
        attempt_id: attemptId,
        job_result: jobResult,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("background-job.failed", err, {
        jobId: job.id,
        jobType: job.job_type,
        attemptId,
      });
      await database.call("app_api", "fail_background_job", {
        job_id: job.id,
        attempt_id: attemptId,
        error_info: { message },
      });
    }
  }

  return { hasMore: jobs.length === 10, processedCount: jobs.length };
}
