import type { AppDatabaseClient } from "../database/client.ts";
import { deleteCloudinaryAsset } from "../shared/cloudinary.ts";
import { markNotionPageDeleted } from "../shared/notion-page.ts";
import { reconcileNotionPages } from "../shared/notion-reconcile.ts";
import { createFunctionLogger } from "../shared/observability.ts";
import { asRecord, asString } from "../shared/http.ts";
import { operationPolicy } from "../shared/operation-policies.ts";
import type { Json, Selected } from "../database/schema.ts";

export interface BackgroundJobItem {
  id: string;
  job_type: string;
  scope_id: string;
  payload: Record<string, unknown>;
  status: string;
  attempt_count: number;
  last_attempt_id: string;
}

export async function processBackgroundJobs(database: AppDatabaseClient) {
  const log = createFunctionLogger("processBackgroundJobs");
  const { data: policyResult, error: policyError } = await database.call(
    "app_api", "backend_process_platform_job_batch", { batch_size: operationPolicy('policyBatchSize') },
  );
  if (policyError) {
    log.error("policy-batch.failed", policyError);
    throw policyError;
  }
  if (asRecord(policyResult).failed === true) log.warn('policy-batch.failed', { jobId: asString(asRecord(policyResult).jobId) });
  const { data, error } = await database.call("app_api", "claim_background_jobs", {
    requested_batch_size: operationPolicy('jobBatchSize'),
  });
  if (error) throw error;
  const jobs = (data ?? []) as BackgroundJobItem[];

  for (const job of jobs) {
    const attemptId = job.last_attempt_id;
    try {
      let jobResult: { [key: string]: Json } = { success: true };

      if (job.job_type === "deletion") {
        const payload = asRecord(job.payload);
        const cloudinaryPublicId = asString(payload.cloudinary_public_id);
        const notionPageId = asString(payload.notion_page_id);
        const targetType = asString(payload.target_type);
        const targetId = asString(payload.target_id);

        if (cloudinaryPublicId) {
          let isCurrentAvatar = false;
          if (targetType === "avatar") {
            const profile = await database.sqlMaybe<Selected<"user_profiles", "avatar_public_id">>`
              select avatar_public_id from app_private.user_profiles where uid = ${targetId}`;
            isCurrentAvatar = profile?.avatar_public_id === cloudinaryPublicId;
          }
          if (!isCurrentAvatar) {
            await deleteCloudinaryAsset(cloudinaryPublicId);
          }
        }

        if (notionPageId) {
          await markNotionPageDeleted(notionPageId);
          await database.sql`delete from app_private.notion_pages
            where target_type = ${targetType} and target_id = ${targetId}`;
        }
      } else if (job.job_type === "notion_reconcile") {
        const reconcileRes = await reconcileNotionPages(database);
        jobResult = { ...jobResult, ...reconcileRes };
      } else {
        throw new Error("unsupported-background-job");
      }

      const { error: completionError } = await database.call("app_api", "complete_background_job", {
        job_id: job.id,
        attempt_id: attemptId,
        job_result: jobResult,
      });
      if (completionError) throw completionError;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.error("background-job.failed", err, {
        jobId: job.id,
        jobType: job.job_type,
        attemptId,
      });
      const { error: failureError } = await database.call("app_api", "fail_background_job", {
        job_id: job.id,
        attempt_id: attemptId,
        error_info: { message },
      });
      if (failureError) throw failureError;
    }
  }

  const { rows: remainingPolicies } = await database.sql<Selected<"background_jobs", "id">>`
    select id from app_private.background_jobs
    where job_type = any(${["retention_cleanup", "category_policy"]})
      and status = any(${["pending", "processing"]}) limit 1`;
  return {
    hasMore: jobs.length === operationPolicy('jobBatchSize') || remainingPolicies.length > 0,
    processedCount: jobs.length,
    policy: policyResult,
  };
}
