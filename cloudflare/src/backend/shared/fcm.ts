import { getGoogleAccessToken } from "./google-oauth.ts";
import { optionalEnv, requireEnv } from "./env.ts";

export interface FcmMessage {
  token?: string;
  topic?: string;
  notification?: {
    body?: string;
    title?: string;
  };
  data?: Record<string, string>;
  webpush?: Record<string, unknown>;
}

const FCM_TOPICS = new Set(["srp-broadcast"]);

function emulatorBaseUrl() {
  return optionalEnv("FCM_EMULATOR_URL").replace(/\/+$/u, "");
}

async function messagingAuthorization(scopes: string[]) {
  if (emulatorBaseUrl()) return "Bearer local-fcm-emulator";
  return `Bearer ${await getGoogleAccessToken(scopes)}`;
}

function assertTopic(topic: string) {
  if (!FCM_TOPICS.has(topic)) throw new Error("invalid-fcm-topic");
}

async function updateTopicSubscriptions(tokens: string[], topic: string, operation: "batchAdd" | "batchRemove") {
  assertTopic(topic);
  if (tokens.length === 0) return;
  const emulatorUrl = emulatorBaseUrl();
  const response = await fetch(`${emulatorUrl || "https://iid.googleapis.com"}/iid/v1:${operation}`, {
    method: "POST",
    headers: {
      authorization: await messagingAuthorization(["https://www.googleapis.com/auth/firebase.messaging"]),
      "content-type": "application/json",
      "access_token_auth": "true",
    },
    body: JSON.stringify({
      to: `/topics/${topic}`,
      registration_tokens: tokens.slice(0, 1000),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new FcmSendError(response.status, await response.text());
  const result = await response.json() as { results?: Array<{ error?: string }> };
  if (result.results?.some((item) => item.error)) {
    throw new Error(`fcm-topic-${operation}-partial-failure`);
  }
  return result;
}

export function subscribeTokensToTopic(tokens: string[], topic: string) {
  return updateTopicSubscriptions(tokens, topic, "batchAdd");
}

export function unsubscribeTokensFromTopic(tokens: string[], topic: string) {
  return updateTopicSubscriptions(tokens, topic, "batchRemove");
}

export function sendFcmTopicMessage(topic: string, data: Record<string, string>) {
  assertTopic(topic);
  return sendFcmMessage({ topic, data });
}

export class FcmSendError extends Error {
  readonly responseBody: string;
  readonly status: number;

  constructor(status: number, responseBody: string) {
    super(`FCM send failed: ${status} ${responseBody}`);
    this.name = "FcmSendError";
    this.status = status;
    this.responseBody = responseBody;
  }
}

export function isInvalidFcmTokenError(error: unknown) {
  if (!(error instanceof FcmSendError)) return false;
  const body = error.responseBody.toUpperCase();
  return body.includes("UNREGISTERED")
    || body.includes('"ERRORCODE":"UNREGISTERED"');
}

export async function sendFcmMessage(message: FcmMessage) {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const scopes = ["https://www.googleapis.com/auth/firebase.messaging"];
  const emulatorUrl = emulatorBaseUrl();

  const response = await fetch(
    `${emulatorUrl || "https://fcm.googleapis.com"}/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: await messagingAuthorization(scopes),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new FcmSendError(response.status, await response.text());
  }

  return response.json();
}
