import type { AppDatabaseClient } from "../database/client.ts";
import { deleteCloudinaryAsset } from "../shared/cloudinary.ts";
import { markNotionPageDeleted } from "../shared/notion-page.ts";
import {
  countNotionRebuildTargets,
  reconcileNotionPages,
  type NotionRebuildCursor,
} from "../shared/notion-reconcile.ts";
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
  result: Record<string, unknown> | null;
}

/**
 * Carries one pass of a Notion rebuild, and hands the job back if there is
 * more.
 *
 * A complete rebuild writes every proposal, facility, announcement and recorded
 * operation, which is more work than one paced run at Notion's request rate can
 * finish. Each pass writes until its share of the invocation's request
 * allowance is spent, records how far it got on the job itself -- which is what
 * the operations screen reads as progress -- and returns the job to the queue at
 * its cursor rather than starting over.
 */
async function advanceNotionRebuild(database: AppDatabaseClient, job: BackgroundJobItem) {
  // A job's payload is what it was asked to do and never changes, so where the
  // rebuild has got to is kept beside its progress in the job's own result,
  // which the completion overwrites with the finished account of the work.
  const cursor = (job.result?.cursor as NotionRebuildCursor | null | undefined) ?? null;
  if (!cursor) {
    const total = await countNotionRebuildTargets(database);
    await database.sql`update app_private.background_jobs
      set estimated_rows = ${total}, processed_rows = 0, updated_at = now() where id = ${job.id}`;
  }
  const pass = await reconcileNotionPages(database, { cursor });
  if (pass.done) {
    await database.sql`update app_private.background_jobs
      set processed_rows = processed_rows + ${pass.written}, updated_at = now() where id = ${job.id}`;
    return pass;
  }
  // The pass succeeded, so it does not spend one of the job's attempts: the
  // job goes back to the queue at its cursor with its attempts cleared.
  await database.sql`update app_private.background_jobs
    set status = 'pending', attempt_count = 0, locked_at = null, last_attempt_id = null,
      next_attempt_at = now(), processed_rows = processed_rows + ${pass.written},
      result = ${JSON.stringify({ cursor: pass.cursor })}::jsonb, updated_at = now()
    where id = ${job.id} and status = 'processing' and last_attempt_id = ${job.last_attempt_id}`;
  return pass;
}

export async function processBackgroundJobs(
  database: AppDatabaseClient,
  options: { batchSize?: number } = {},
) {
  const log = createFunctionLogger("processBackgroundJobs");
  const { data: policyResult, error: policyError } = await database.call(
    "app_api", "backend_process_platform_job_batch", { batch_size: operationPolicy('policyBatchSize') },
  );
  if (policyError) {
    log.error("policy-batch.failed", policyError);
    throw policyError;
  }
  if (asRecord(policyResult).failed === true) log.warn('policy-batch.failed', { jobId: asString(asRecord(policyResult).jobId) });
  const batchSize = options.batchSize ?? operationPolicy('jobBatchSize');
  const { data, error } = await database.call("app_api", "claim_background_jobs", {
    requested_batch_size: batchSize,
  });
  if (error) throw error;
  const jobs = (data ?? []) as BackgroundJobItem[];
  let resumed = 0;

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
        const pass = await advanceNotionRebuild(database, job);
        if (!pass.done) {
          resumed += 1;
          continue;
        }
        jobResult = { ...jobResult, pages: pass.written };
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
    hasMore: resumed > 0 || jobs.length === batchSize || remainingPolicies.length > 0,
    processedCount: jobs.length,
    policy: policyResult,
  };
}
