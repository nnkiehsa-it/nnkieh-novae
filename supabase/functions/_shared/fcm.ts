import { getGoogleAccessToken } from "./google-oauth.ts";
import { requireEnv } from "./env.ts";

export interface FcmMessage {
  token: string;
  notification?: {
    body?: string;
    title?: string;
  };
  data?: Record<string, string>;
  webpush?: Record<string, unknown>;
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
  return error.status === 404
    || body.includes("UNREGISTERED")
    || body.includes("NOT_FOUND")
    || body.includes("INVALID_ARGUMENT");
}

export async function sendFcmMessage(message: FcmMessage) {
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const accessToken = await getGoogleAccessToken([
    "https://www.googleapis.com/auth/firebase.messaging",
  ]);

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    },
  );

  if (!response.ok) {
    throw new FcmSendError(response.status, await response.text());
  }

  return response.json();
}
