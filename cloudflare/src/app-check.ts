import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import type { Env } from "./types";

const APP_CHECK_HEADER = "x-firebase-appcheck";
const APP_CHECK_KEYS = createRemoteJWKSet(
  new URL("https://firebaseappcheck.googleapis.com/v1/jwks"),
);

function configuredAppIds(env: Env) {
  return new Set(
    env.FIREBASE_APP_IDS.split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

export function validateFirebaseAppCheckClaims(payload: JWTPayload, env: Env) {
  const appId = typeof payload.sub === "string" ? payload.sub : "";
  if (!appId || !configuredAppIds(env).has(appId)) {
    throw new Error("app-check-failed");
  }
  return appId;
}

export async function requireFirebaseAppCheck(request: Request, env: Env) {
  if (env.LOCAL_TEST_MODE === "true") return "local-test-app";
  const token = request.headers.get(APP_CHECK_HEADER)?.trim() ?? "";
  if (!token) throw new Error("app-check-failed");

  try {
    const { payload } = await jwtVerify(token, APP_CHECK_KEYS, {
      algorithms: ["RS256"],
      audience: `projects/${env.FIREBASE_PROJECT_NUMBER}`,
      issuer: `https://firebaseappcheck.googleapis.com/${env.FIREBASE_PROJECT_NUMBER}`,
      typ: "JWT",
    });
    return validateFirebaseAppCheckClaims(payload, env);
  } catch {
    throw new Error("app-check-failed");
  }
}
