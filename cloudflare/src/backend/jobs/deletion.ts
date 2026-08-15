import type { AppDatabaseClient } from "../database/client.ts";
import { deleteCloudinaryAsset } from "../shared/cloudinary.ts";
import { markNotionPageDeleted } from "../shared/notion.ts";
import { createFunctionLogger } from "../shared/observability.ts";

interface DeletionJob {
  id: string;
  cloudinary_public_id?: string | null;
  notion_page_id?: string | null;
  target_id: string;
  target_type: string;
}

export async function processDeletionBatch(database: AppDatabaseClient) {
  const log = createFunctionLogger("processDeletionJobs");
  const { data, error } = await database.call("app_api", "claim_deletion_jobs", { batch_size: 10 });
  if (error) throw error;

  const jobs = (data ?? []) as DeletionJob[];
  const processJob = async (job: DeletionJob) => {
    try {
      if (job.cloudinary_public_id) {
        let isCurrentAvatar = false;
        if (job.target_type === "avatar") {
          const { data: profile, error: profileError } = await database
            .table("app_private", "user_profiles")
            .select("avatar_public_id")
            .eq("uid", job.target_id)
            .maybeSingle();
          if (profileError) throw profileError;
          isCurrentAvatar = profile?.avatar_public_id === job.cloudinary_public_id;
        }
        if (!isCurrentAvatar) await deleteCloudinaryAsset(job.cloudinary_public_id);
      }
      if (job.notion_page_id) {
        await markNotionPageDeleted(job.notion_page_id);
        const { error: mappingError } = await database.table("app_private", "notion_pages")
          .delete()
          .eq("target_type", job.target_type)
          .eq("target_id", job.target_id);
        if (mappingError) throw mappingError;
      }
      const { error: completeError } = await database.call("app_api", "complete_deletion_job", {
        job_id: job.id,
      });
      if (completeError) throw completeError;
    } catch (jobError) {
      const traceCode = crypto.randomUUID();
      log.error("deletion-job.failed", jobError, {
        jobId: job.id,
        targetType: job.target_type,
        traceCode,
      });
      const { error: failError } = await database.call("app_api", "fail_deletion_job", {
        job_id: job.id,
        error_trace_id: traceCode,
      });
      if (failError) throw failError;
    }
  };

  for (let offset = 0; offset < jobs.length; offset += 3) {
    await Promise.all(jobs.slice(offset, offset + 3).map(processJob));
  }
  const hasMore = jobs.length === 10;
  log.success("deletion-worker.completed", { hasMore, processedCount: jobs.length, status: 200 });
  return { hasMore, processedCount: jobs.length };
}
