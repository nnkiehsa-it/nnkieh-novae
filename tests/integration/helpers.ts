import assert from "node:assert/strict";
import { createClient } from "npm:@supabase/supabase-js@2";
import type { Database } from "../../supabase/functions/_shared/database.ts";
import { getBackendActionDefinition } from "../../supabase/functions/backendAction/action-registry.ts";
import { resolveAuthContext } from "../../supabase/functions/backendAction/auth.ts";
import { executeBackendAction } from "../../supabase/functions/backendAction/execution.ts";
import type {
  AuthContext,
  BackendSupabase,
  JsonRecord,
} from "../../supabase/functions/backendAction/types.ts";

function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is required for local integration tests.`);
  return value;
}

export const supabase = createClient<Database>(
  requiredEnv("SUPABASE_URL"),
  requiredEnv("APP_SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
) as BackendSupabase;

export interface TestIdentity {
  email: string;
  name: string;
  photoUrl: string | null;
  uid: string;
}

export function integrationTest(
  name: string,
  execute: () => void | Promise<void>,
) {
  Deno.test({
    fn: execute,
    name,
    // supabase-js can finish an internal compatibility timer during the
    // following test. Resource sanitization and all durable assertions remain.
    sanitizeOps: false,
  });
}

export function asRecord(value: unknown): JsonRecord {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as JsonRecord;
}

export function requestId(label: string) {
  return `${label}-${crypto.randomUUID()}`;
}

export async function seedActor(
  label: string,
  options: {
    categoryIds?: string[];
    roles?: string[];
  } = {},
) {
  const uid = `local-test-${label}-${crypto.randomUUID()}`;
  const identity: TestIdentity = {
    email: `${uid}@integration.invalid`,
    name: `Integration ${label}`,
    photoUrl: null,
    uid,
  };
  const { error: profileError } = await supabase.schema("app_private")
    .from("user_profiles")
    .insert({
      display_name: identity.name,
      email: identity.email,
      photo_url: null,
      uid,
    });
  if (profileError) throw profileError;

  if (options.roles?.length) {
    const { error } = await supabase.schema("app_private")
      .from("user_role_assignments")
      .insert(options.roles.map((role_code) => ({
        granted_by: uid,
        role_code,
        uid,
      })));
    if (error) throw error;
  }
  if (options.categoryIds?.length) {
    const { error } = await supabase.schema("app_private")
      .from("user_issue_category_assignments")
      .insert(options.categoryIds.map((category_id) => ({
        category_id,
        granted_by: uid,
        uid,
      })));
    if (error) throw error;
  }

  return {
    identity,
    auth: await resolveAuthContext(supabase, identity),
  };
}

export async function refreshActor(actor: { identity: TestIdentity }) {
  return {
    ...actor,
    auth: await resolveAuthContext(supabase, actor.identity),
  };
}

export async function callAction(
  actionName: string,
  payload: JsonRecord,
  auth: AuthContext,
) {
  const definition = getBackendActionDefinition(actionName);
  assert.ok(definition, `Missing backend action definition: ${actionName}`);
  return await executeBackendAction(definition, payload, auth, supabase);
}

export async function expectActionError(
  expectedMessage: string | RegExp,
  execute: () => Promise<unknown>,
) {
  await assert.rejects(execute, (error: unknown) => {
    const message = error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : String(error);
    if (typeof expectedMessage === "string") {
      assert.ok(
        message.includes(expectedMessage),
        `Expected "${expectedMessage}" in "${message}"`,
      );
    } else {
      assert.match(message, expectedMessage);
    }
    return true;
  });
}

export async function insertReadyUpload(ownerUid: string, label: string) {
  const id = crypto.randomUUID();
  const cloudinaryPublicId = `srp/${ownerUid}/${label}-${id}`;
  const { error } = await supabase.schema("app_private").from("uploads").insert({
    cloudinary_public_id: cloudinaryPublicId,
    content_type: "image/webp",
    height: 64,
    id,
    owner_uid: ownerUid,
    size_bytes: 256,
    status: "ready",
    visibility: "authenticated",
    width: 64,
  });
  if (error) throw error;
  return { cloudinaryPublicId, id };
}

export async function tableRow(
  table: keyof Database["app_private"]["Tables"],
  column: string,
  value: string,
) {
  const { data, error } = await supabase.schema("app_private")
    .from(table)
    .select("*")
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return data as JsonRecord | null;
}
