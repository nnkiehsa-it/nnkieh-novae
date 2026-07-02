import { createClient } from "npm:@supabase/supabase-js@2";
import { requireEnv } from "../_shared/env.ts";
import { verifyCloudinarySignature } from "../_shared/webhook.ts";

Deno.serve(async (request) => {
  const rawBody = await request.text();
  const signatureFailure = await verifyCloudinarySignature(request, rawBody);
  if (signatureFailure) return signatureFailure;

  const payload = JSON.parse(rawBody);
  const publicId = String(payload.public_id ?? "");
  if (!publicId) {
    return new Response("Missing public_id", { status: 400 });
  }

  const supabase = createClient(
    requireEnv("SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
  const { error } = await supabase
    .schema("app_private")
    .from("uploads")
    .update({
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("cloudinary_public_id", publicId)
    .eq("status", "pending");

  if (error) {
    throw error;
  }

  return Response.json({ ok: true });
});
