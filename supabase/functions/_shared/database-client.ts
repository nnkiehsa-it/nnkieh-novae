import { PostgrestClient } from "npm:@supabase/postgrest-js@2.112.2";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.112.2";
import type { Database } from "./database.ts";
import { requireEnv } from "./env.ts";

export type AppDatabaseClient = SupabaseClient<Database>;

function databaseHeaders(key: string) {
  const headers: Record<string, string> = { apikey: key };
  if (!key.startsWith("sb_publishable_") && !key.startsWith("sb_secret_")) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

export function createDatabaseClient(): AppDatabaseClient {
  const baseUrl = requireEnv("SUPABASE_URL").replace(/\/+$/u, "");
  const key = requireEnv("APP_SUPABASE_SERVICE_ROLE_KEY");
  return new PostgrestClient<Database>(`${baseUrl}/rest/v1`, {
    headers: databaseHeaders(key),
  }) as unknown as AppDatabaseClient;
}
