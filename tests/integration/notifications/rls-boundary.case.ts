import { assert, authenticatedJwt, callAction, createClient, DATA_RETENTION, expectActionError, failNextFcmRequests, integrationTest, notificationStressScale, readFcmRequests, requestId, requiredEnv, resetFcmRequests, saveCategoryDraft, seedActor, supabase } from "./support.ts";
import type { Database } from "./support.ts";

integrationTest("raw PostgREST access fails closed while service role remains available", async () => {
  const url = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const anon = createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
  });
  const anonResult = await anon.schema("app_private").from("user_profiles").select("uid").limit(1);
  assert.ok(anonResult.error, "anon must not read app_private.user_profiles");

  const uid = `local-test-rls-${crypto.randomUUID()}`;
  const authenticated = createClient<Database>(url, anonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${await authenticatedJwt(uid)}`,
      },
    },
  });
  const authenticatedResult = await authenticated.schema("app_private")
    .from("user_profiles")
    .select("uid")
    .limit(1);
  assert.ok(authenticatedResult.error, "authenticated must not read private profiles directly");

  const serviceResult = await supabase.schema("app_private")
    .from("user_profiles")
    .select("uid")
    .limit(1);
  assert.equal(serviceResult.error, null);
});
