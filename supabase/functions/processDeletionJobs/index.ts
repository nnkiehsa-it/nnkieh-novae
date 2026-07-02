import { createClient } from "npm:@supabase/supabase-js@2";
import { deleteCloudinaryAsset } from "../_shared/cloudinary.ts";
import { requireEnv } from "../_shared/env.ts";
import { markNotionPageDeleted } from "../_shared/notion.ts";
import { requireBearerSecret } from "../_shared/webhook.ts";

interface DeletionJob {
  id: string;
  cloudinary_public_id?: string | null;
  notion_page_id?: string | null;
  target_id: string;
  target_type: string;
}

Deno.serve(async (request) => {
  const authFailure = requireBearerSecret(request);
  if (authFailure) return authFailure;

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  const { data, error } = await supabase
    .schema("app_api")
    .rpc("claim_deletion_jobs", { batch_size: 50 });

  if (error) throw error;

  const jobs = (data ?? []) as DeletionJob[];
  for (const job of jobs) {
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
      const { error: failError } = await supabase
        .schema("app_api")
        .rpc("fail_deletion_job", {
          job_id: job.id,
          error_message: error instanceof Error ? error.message : String(error),
        });
      if (failError) throw failError;
    }
  }

  return Response.json({ ok: true, processedCount: jobs.length });
});
