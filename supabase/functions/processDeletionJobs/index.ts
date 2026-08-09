import { createDatabaseClient } from "../_shared/database-client.ts";
import { deleteCloudinaryAsset } from "../_shared/cloudinary.ts";
import { errorStatus, jsonResponse, publicErrorBody, requireMethod } from "../_shared/http.ts";
import { markNotionPageDeleted } from "../_shared/notion.ts";
import { createFunctionLogger } from "../_shared/observability.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimits, utcMinuteWindow, utcSecondWindow } from "../_shared/upstash-rate-limit.ts";
import { requireBearerSecret } from "../_shared/webhook.ts";
import { requireOriginSecret } from "../_shared/origin.ts";

interface DeletionJob {
  id: string;
  cloudinary_public_id?: string | null;
  notion_page_id?: string | null;
  target_id: string;
  target_type: string;
}

Deno.serve(async (request) => {
  const originFailure = requireOriginSecret(request);
  if (originFailure) return originFailure;
  const methodFailure = requireMethod(request, "POST");
  if (methodFailure) return methodFailure;

  const authFailure = requireBearerSecret(request);
  if (authFailure) return authFailure;

  const log = createFunctionLogger("processDeletionJobs");
  try {
    await claimFixedWindowRateLimits([
      { identifier: "global", actionName: "worker.deletion.second", window: utcSecondWindow(), config: RATE_LIMITS.workerRunSecond },
      { identifier: "global", actionName: "worker.deletion", window: utcMinuteWindow(), config: RATE_LIMITS.workerRunMinute },
    ]);
    const supabase = createDatabaseClient();
    const { data, error } = await supabase
      .schema("app_api")
      .rpc("claim_deletion_jobs", { batch_size: 10 });

    if (error) throw error;

    const jobs = (data ?? []) as DeletionJob[];
    const processJob = async (job: DeletionJob) => {
      try {
        if (job.cloudinary_public_id) {
          let isCurrentAvatar = false;
          if (job.target_type === "avatar") {
            const { data: profile, error: profileError } = await supabase
              .schema("app_private")
              .from("user_profiles")
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
          const { error: mappingError } = await supabase
            .schema("app_private")
            .from("notion_pages")
            .delete()
            .eq("target_type", job.target_type)
            .eq("target_id", job.target_id);
          if (mappingError) throw mappingError;
        }
        const { error: completeError } = await supabase
          .schema("app_api")
          .rpc("complete_deletion_job", { job_id: job.id });
        if (completeError) throw completeError;
      } catch (error) {
        const traceCode = crypto.randomUUID();
        log.error("deletion-job.failed", error, {
          jobId: job.id,
          targetType: job.target_type,
          traceCode,
        });
        const { error: failError } = await supabase
          .schema("app_api")
          .rpc("fail_deletion_job", {
            job_id: job.id,
            error_trace_id: traceCode,
          });
        if (failError) throw failError;
      }
    };
    for (let offset = 0; offset < jobs.length; offset += 3) {
      await Promise.all(jobs.slice(offset, offset + 3).map(processJob));
    }
    if (jobs.length === 10) {
      const { error: resignalError } = await supabase.schema("app_api")
        .rpc("resignal_background_worker", { worker_name: "deletion" });
      if (resignalError) {
        log.error("deletion-backlog-resignal.failed", resignalError);
      }
    }

    log.success("deletion-worker.completed", { processedCount: jobs.length, status: 200 });
    return jsonResponse({ ok: true, processedCount: jobs.length });
  } catch (error) {
    const status = errorStatus(error);
    if (status >= 500) log.error("deletion-worker.failed", error, { status });
    else log.warn("deletion-worker.rejected", { status });
    return jsonResponse({ ok: false, error: publicErrorBody(error) }, { status });
  }
});
