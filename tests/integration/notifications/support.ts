import assert from "node:assert/strict";
import { createClient } from "npm:@supabase/supabase-js@2";
import { DATA_RETENTION } from "../../../supabase/functions/_shared/data-retention.ts";
import type { Database } from "../../../supabase/functions/_shared/database.ts";
import {
  asRecord,
  callAction,
  expectActionError,
  integrationTest,
  requestId,
  saveCategoryDraft,
  seedActor,
  supabase,
} from "../helpers.ts";

export const notificationStressScale = Math.min(
  20,
  Math.max(4, Number(Deno.env.get("NOVAE_STRESS_SCALE") ?? 4)),
);

export function requiredEnv(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} is required for local integration tests.`);
  return value;
}

export interface FcmRequest {
  body: {
    message?: {
      data?: Record<string, string>;
      token?: string;
      topic?: string;
    };
  };
  path: string;
}

export function fcmReceiverUrl() {
  return requiredEnv("FCM_EMULATOR_URL").replace("host.docker.internal", "127.0.0.1");
}

export async function resetFcmRequests() {
  const response = await fetch(`${fcmReceiverUrl()}/__requests`, { method: "DELETE" });
  assert.equal(response.status, 200);
}

export async function readFcmRequests() {
  const response = await fetch(`${fcmReceiverUrl()}/__requests`);
  assert.equal(response.status, 200);
  const result = await response.json() as { requests: FcmRequest[] };
  return result.requests;
}

export async function failNextFcmRequests(count: number) {
  const response = await fetch(`${fcmReceiverUrl()}/__fail-next`, {
    body: JSON.stringify({ count }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  assert.equal(response.status, 200);
}

export function base64Url(value: string | Uint8Array) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/gu, "-").replace(/\//gu, "_").replace(/=+$/gu, "");
}

export async function authenticatedJwt(uid: string) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    aud: Deno.env.get("FIREBASE_PROJECT_ID") ?? "local-test",
    exp: now + 3600,
    iat: now,
    role: "authenticated",
    sub: uid,
  }));
  const signingInput = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(requiredEnv("SUPABASE_JWT_SECRET")),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

export { assert, createClient, DATA_RETENTION, asRecord, callAction, expectActionError, integrationTest, requestId, saveCategoryDraft, seedActor, supabase };
export type { Database };
