import { getGoogleAccessToken } from "./google-oauth.ts";
import { optionalEnv, requireEnv } from "./env.ts";

export interface FcmMessage {
  token?: string;
  notification?: {
    body?: string;
    title?: string;
  };
  data?: Record<string, string>;
  webpush?: Record<string, unknown>;
}

function emulatorBaseUrl() {
  return optionalEnv("FCM_EMULATOR_URL").replace(/\/+$/u, "");
}

async function messagingAuthorization(scopes: string[]) {
  if (emulatorBaseUrl()) return "Bearer local-fcm-emulator";
  return `Bearer ${await getGoogleAccessToken(scopes)}`;
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
