import assert from "node:assert/strict";
import { processJobMessage } from "../../../cloudflare/src/backend/jobs/consumer.ts";
import {
  asRecord,
  callAction,
  expectActionError,
  integrationTest,
  operationId,
  saveCategoryDraft,
  seedActor,
  database,
  testEnvironment,
} from "../helpers.ts";

export const notificationStressScale = Math.min(
  20,
  Math.max(4, Number(process.env.NOVAE_STRESS_SCALE ?? 4)),
);

export function requiredEnv(name: string) {
  const value = process.env[name]?.trim();
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

export async function drainJobs() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const result = await processJobMessage({ type: "drain" }, testEnvironment);
    if (!result.backgroundJobs.hasMore && !result.push.hasMore && !result.realtime.hasMore && !result.notion.hasMore && !result.inApp.hasMore) return result;
  }
  throw new Error("integration-job-drain-did-not-settle");
}

export { assert, asRecord, callAction, expectActionError, integrationTest, operationId, saveCategoryDraft, seedActor, database };
