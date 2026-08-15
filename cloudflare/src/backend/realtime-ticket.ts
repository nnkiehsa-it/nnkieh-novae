import { SignJWT } from "jose";
import type { AppDatabaseClient } from "./database/client.ts";
import { resolveAuthContext } from "./actions/auth.ts";
import { requireVerifiedFirebaseUser } from "./shared/firebase-auth.ts";
import { requireEnv } from "./shared/env.ts";

const TICKET_LIFETIME_SECONDS = 45;

function websocketUrl() {
  const url = new URL("/v1/realtime", requireEnv("PUBLIC_API_URL"));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export async function createRealtimeTicket(request: Request, database: AppDatabaseClient) {
  const firebaseUser = await requireVerifiedFirebaseUser(request);
  const auth = await resolveAuthContext(database, firebaseUser);
  const topics = [
    "content:school",
    auth.isAdmin ? "content:admin" : `content:user:${auth.uid}`,
    "notifications:broadcast",
    `notifications:user:${auth.uid}`,
    `notification-state:${auth.uid}`,
    ...(auth.isAdmin ? ["notifications:admin"] : []),
  ];
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + TICKET_LIFETIME_SECONDS;
  const ticket = await new SignJWT({ topics })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer("novae-api")
    .setAudience("novae-realtime")
    .setSubject(auth.uid)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .setJti(crypto.randomUUID())
    .sign(new TextEncoder().encode(requireEnv("REALTIME_TICKET_SECRET")));
  return { expiresAtMs: expiresAt * 1000, ticket, url: websocketUrl() };
}
