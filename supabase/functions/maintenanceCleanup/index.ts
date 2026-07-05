import { createClient } from "npm:@supabase/supabase-js@2";
import type { Database } from "../_shared/database.ts";
import { requireEnv } from "../_shared/env.ts";
import { errorMessage, jsonResponse, requireMethod } from "../_shared/http.ts";
import { requireBearerSecret } from "../_shared/webhook.ts";

Deno.serve(async (request) => {
  const methodFailure = requireMethod(request, "POST");
  if (methodFailure) return methodFailure;

  const authFailure = requireBearerSecret(request);
  if (authFailure) return authFailure;

  try {
    const supabase = createClient<Database>(
      requireEnv("SUPABASE_URL"),
      requireEnv("APP_SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false } },
    );
    const { data, error } = await supabase
      .schema("app_api")
      .rpc("run_maintenance_cleanup");
    if (error) throw error;

    return jsonResponse({ ok: true, result: data });
  } catch (error) {
    return jsonResponse({ ok: false, error: errorMessage(error) }, { status: 500 });
  }
});
