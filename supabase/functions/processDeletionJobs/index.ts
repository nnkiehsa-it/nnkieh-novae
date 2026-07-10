import { createClient } from "npm:@supabase/supabase-js@2";
import type { Database } from "../_shared/database.ts";
import { deleteCloudinaryAsset } from "../_shared/cloudinary.ts";
import { requireEnv } from "../_shared/env.ts";
import { errorMessage, errorStatus, jsonResponse, publicError, requireMethod } from "../_shared/http.ts";
import { markNotionPageDeleted } from "../_shared/notion.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimits, utcMinuteWindow, utcSecondWindow } from "../_shared/upstash-rate-limit.ts";
import { requireBearerSecret } from "../_shared/webhook.ts";

interface DeletionJob {
  id: string;
  cloudinary_public_id?: string | null;
  notion_page_id?: string | null;
  target_id: string;
  target_type: string;
}

Deno.serve(async (request) => {
  const methodFailure = requireMethod(request, "POST");
  if (methodFailure) return methodFailure;

  const authFailure = requireBearerSecret(request);
  if (authFailure) return authFailure;

  try {
    await claimFixedWindowRateLimits([
      { identifier: "global", actionName: "worker.deletion.second", window: utcSecondWindow(), config: RATE_LIMITS.workerRunSecond },
      { identifier: "global", actionName: "worker.deletion", window: utcMinuteWindow(), config: RATE_LIMITS.workerRunMinute },
    ]);
    const supabase = createClient<Database>(
      requireEnv("SUPABASE_URL"),
      requireEnv("APP_SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase
      .schema("app_api")
      .rpc("claim_deletion_jobs", { batch_size: 10 });

    if (error) throw error;

    const jobs = (data ?? []) as DeletionJob[];
    const processJob = async (job: DeletionJob) => {
      try {
        if (job.cloudinary_public_id) {
          await deleteCloudinaryAsset(job.cloudinary_public_id);
        }
        if (job.notion_page_id) {
          await markNotionPageDeleted(job.notion_page_id);
        }
        const { error: completeError } = await supabase
          .schema("app_api")
          .rpc("complete_deletion_job", { job_id: job.id });
        if (completeError) throw completeError;
      } catch (error) {
        const traceCode = crypto.randomUUID();
        console.error(JSON.stringify({
          error: errorMessage(error),
          jobId: job.id,
          targetId: job.target_id,
          targetType: job.target_type,
          traceCode,
        }));
        const { error: failError } = await supabase
          .schema("app_api")
          .rpc("fail_deletion_job", {
            job_id: job.id,
            error_message: traceCode,
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
        console.error("deletion backlog resignal failed", errorMessage(resignalError));
      }
    }

    return jsonResponse({ ok: true, processedCount: jobs.length });
  } catch (error) {
    console.error(errorMessage(error));
    return jsonResponse({ ok: false, error: publicError(error) }, { status: errorStatus(error) });
  }
});
