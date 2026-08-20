import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";
import { afterAll, beforeEach, test } from "vitest";
import { AppDatabaseClient } from "../../cloudflare/src/backend/database/client.ts";
import { getBackendActionDefinition } from "../../cloudflare/src/backend/actions/action-registry.ts";
import { resolveAuthContext } from "../../cloudflare/src/backend/actions/auth.ts";
import { executeBackendAction } from "../../cloudflare/src/backend/actions/execution.ts";
import { withRuntimeEnvironment } from "../../cloudflare/src/backend/shared/env.ts";
import type {
  AuthContext,
  BackendDatabase,
  JsonRecord,
} from "../../cloudflare/src/backend/actions/types.ts";
import type { Env } from "../../cloudflare/src/types.ts";
import type { DurableRateLimitClaim } from "../../cloudflare/src/durable/business-rate-limiter.ts";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for local integration tests.`);
  return value;
}

export const database = new AppDatabaseClient(requiredEnv("DATABASE_URL"));
const ownerDatabase = new pg.Client({ connectionString: requiredEnv("DATABASE_OWNER_URL") });
let ownerDatabaseConnected = false;

const businessLimits = new Map<string, Map<string, { expiresAtMs: number; units: number }>>();
const successfulIngress = { limit: async () => ({ success: true }) };
const businessRateLimits = {
  getByName(identifier: string) {
    return {
      claim(claims: DurableRateLimitClaim[]) {
        const now = Date.now();
        const entries = businessLimits.get(identifier) ?? new Map();
        for (const [key, value] of entries) {
          if (value.expiresAtMs <= now) entries.delete(key);
        }
        for (const claim of claims) {
          const current = entries.get(claim.key)?.units ?? 0;
          if (current + claim.units > claim.limit) {
            return {
              errorCode: claim.errorCode,
              retryAfterSeconds: Math.max(1, Math.ceil((claim.expiresAtMs - now) / 1000)),
              success: false,
            };
          }
        }
        for (const claim of claims) {
          const current = entries.get(claim.key)?.units ?? 0;
          entries.set(claim.key, { expiresAtMs: claim.expiresAtMs, units: current + claim.units });
        }
        businessLimits.set(identifier, entries);
        return { success: true };
      },
    };
  },
};

export const testEnvironment = {
  ADMIN_EMAILS: "admin@integration.invalid",
  ADMIN_WRITE_RATE_LIMITER: successfulIngress,
  ALLOWED_DOMAIN: "integration.invalid",
  ALLOWED_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000",
  BUSINESS_RATE_LIMITS: businessRateLimits,
  CLOUDINARY_API_BASE_URL: process.env.CLOUDINARY_API_BASE_URL,
  CLOUDINARY_API_KEY: "integration-api-key",
  CLOUDINARY_API_SECRET: "integration-api-secret",
  CLOUDINARY_CLOUD_NAME: "integration-cloud",
  CLOUDINARY_DELIVERY_BASE_URL: process.env.CLOUDINARY_DELIVERY_BASE_URL,
  DATABASE_URL: requiredEnv("DATABASE_URL"),
  FCM_EMULATOR_URL: process.env.FCM_EMULATOR_URL,
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIREBASE_APP_IDS: "1:123456789:web:local",
  FIREBASE_PROJECT_ID: "integration-project",
  FIREBASE_PROJECT_NUMBER: "123456789",
  FIREBASE_WEB_API_KEY: "integration-web-api-key",
  GOOGLE_SERVICE_ACCOUNT_JSON: "not-used-with-emulator",
  HEALTHCHECK_SECRET: "integration-healthcheck-secret",
  INVALID_AUTH_IP_RATE_LIMITER: successfulIngress,
  JOBS: { send: async () => undefined },
  LOGIN_IP_RATE_LIMITER: successfulIngress,
  LOCAL_TEST_MODE: "true",
  MEDIA_INVALID_IP_RATE_LIMITER: successfulIngress,
  MEDIA_SIGNING_SECRET: "integration-media-signing-secret-that-is-long-enough",
  MEDIA_USER_RATE_LIMITER: successfulIngress,
  NOTION_ENABLED: "false",
  PUBLIC_API_URL: "http://127.0.0.1:8787",
  READ_RATE_LIMITER: successfulIngress,
  REALTIME: { getByName: () => ({ publish: async () => ({ delivered: 0 }) }) },
  REALTIME_TICKET_SECRET: "integration-realtime-ticket-secret-that-is-long-enough",
  SENSITIVE_WRITE_RATE_LIMITER: successfulIngress,
  SYNC_USER_RATE_LIMITER: successfulIngress,
  TURNSTILE_SECRET_KEY: "integration-turnstile-secret",
  UPLOAD_RESOLVE_RATE_LIMITER: successfulIngress,
  UPLOAD_WRITE_RATE_LIMITER: successfulIngress,
  WEBHOOK_GLOBAL_RATE_LIMITER: successfulIngress,
  WEBHOOK_IP_RATE_LIMITER: successfulIngress,
  WRITE_RATE_LIMITER: successfulIngress,
} as unknown as Env;

const resetSql = `
  do $$
  declare
    statement text;
  begin
    select 'truncate table '
      || string_agg(format('%I.%I', schemaname, tablename), ', ')
      || ' restart identity cascade'
    into statement
    from pg_tables
    where schemaname = 'app_private';
    if statement is not null then execute statement; end if;
  end
  $$;
`;
const bootstrapSql = await readFile(
  join(process.cwd(), "database", "migrations", "0002_bootstrap.sql"),
  "utf8",
);
const integrationSeedSql = await readFile(
  join(process.cwd(), "database", "seed.integration.sql"),
  "utf8",
);

beforeEach(async () => {
  if (!ownerDatabaseConnected) {
    await ownerDatabase.connect();
    ownerDatabaseConnected = true;
  }
  await ownerDatabase.query(resetSql);
  await ownerDatabase.query(bootstrapSql);
  await ownerDatabase.query(integrationSeedSql);
  businessLimits.clear();
});

afterAll(async () => {
  await database.close();
  if (ownerDatabaseConnected) await ownerDatabase.end();
});

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
  test(name, async () => {
    await database.connect();
    await withRuntimeEnvironment(testEnvironment, execute);
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
    facilityCategoryIds?: string[];
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
  const { error: profileError } = await database
    .table("app_private", "user_profiles")
    .insert({
      display_name: identity.name,
      email: identity.email,
      photo_url: null,
      uid,
    });
  if (profileError) throw profileError;

  if (options.roles?.length) {
    const { error } = await database
      .table("app_private", "user_role_assignments")
      .insert(options.roles.map((role_code) => ({
        granted_by: uid,
        role_code,
        uid,
      })));
    if (error) throw error;
  }
  if (options.categoryIds?.length) {
    const { error } = await database
      .table("app_private", "user_issue_category_assignments")
      .insert(options.categoryIds.map((category_id) => ({
        category_id,
        granted_by: uid,
        uid,
      })));
    if (error) throw error;
  }
  if (options.facilityCategoryIds?.length) {
    const { error } = await database
      .table("app_private", "user_facility_category_assignments")
      .insert(options.facilityCategoryIds.map((category_id) => ({
        category_id,
        granted_by: uid,
        uid,
      })));
    if (error) throw error;
  }

  return {
    identity,
    auth: await resolveAuthContext(database as BackendDatabase, identity),
  };
}

export async function refreshActor(actor: { identity: TestIdentity }) {
  return {
    ...actor,
    auth: await resolveAuthContext(database as BackendDatabase, actor.identity),
  };
}

export async function callAction(
  actionName: string,
  payload: JsonRecord,
  auth: AuthContext,
) {
  const definition = getBackendActionDefinition(actionName);
  assert.ok(definition, `Missing backend action definition: ${actionName}`);
  return await executeBackendAction(definition, payload, auth, database as BackendDatabase);
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

export async function saveCategoryDraft(
  auth: AuthContext,
  options: {
    announcementCommentsEnabled?: boolean;
    deletedFacilityCategoryIds?: string[];
    deletedIssueCategoryIds?: string[];
    facilitiesEnabled?: boolean;
    issuesEnabled?: boolean;
    upsertFacilityCategories?: JsonRecord[];
    upsertIssueCategories?: JsonRecord[];
  },
) {
  const current = asRecord(await callAction("getCategoryManagement", {}, auth));
  const deletedIssueIds = new Set(options.deletedIssueCategoryIds ?? []);
  const deletedFacilityIds = new Set(options.deletedFacilityCategoryIds ?? []);
  const merge = (existing: unknown, additions: JsonRecord[], deletedIds: Set<string>) => {
    const byId = new Map(
      (Array.isArray(existing) ? existing : []).map((value) => {
        const category = asRecord(value);
        return [String(category.id), category] as const;
      }),
    );
    for (const id of deletedIds) byId.delete(id);
    for (const category of additions) byId.set(String(category.id), category);
    return [...byId.values()].map((category, sortOrder) => ({ ...category, sortOrder }));
  };
  const features = asRecord(current.features);
  return await callAction("saveCategoryManagement", {
    announcementCommentsEnabled: options.announcementCommentsEnabled
      ?? Boolean(features.announcementCommentsEnabled),
    deletedFacilityCategoryIds: [...deletedFacilityIds],
    deletedIssueCategoryIds: [...deletedIssueIds],
    facilitiesEnabled: options.facilitiesEnabled ?? Boolean(features.facilitiesEnabled),
    facilityCategories: merge(
      current.facilityCategories,
      options.upsertFacilityCategories ?? [],
      deletedFacilityIds,
    ),
    issueCategories: merge(
      current.issueCategories,
      options.upsertIssueCategories ?? [],
      deletedIssueIds,
    ),
    issuesEnabled: options.issuesEnabled ?? Boolean(features.issuesEnabled),
    requestId: requestId("save-category-draft"),
  }, auth);
}

export async function insertReadyUpload(ownerUid: string, label: string) {
  const id = crypto.randomUUID();
  const cloudinaryPublicId = `srp/${ownerUid}/${label}-${id}`;
  const { error } = await database.table("app_private", "uploads").insert({
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
  table: Parameters<AppDatabaseClient["table"]>[1],
  column: string,
  value: string,
) {
  const { data, error } = await database
    .table("app_private", table)
    .select("*")
    .eq(column, value)
    .maybeSingle();
  if (error) throw error;
  return data as JsonRecord | null;
}
