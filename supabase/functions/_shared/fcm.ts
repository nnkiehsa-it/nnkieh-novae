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
    throw new Error(`FCM send failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}
