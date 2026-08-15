import { importPKCS8, SignJWT } from "jose";
import { requireEnv } from "./env.ts";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface CachedToken {
  expiresAtMs: number;
  value: string;
}

const cachedTokens = new Map<string, CachedToken>();

function scopeCacheKey(scopes: string[]) {
  return [...new Set(scopes)].sort().join(" ");
}

function serviceAccountCredentials() {
  let value: unknown;
  try {
    value = JSON.parse(requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON"));
  } catch {
    throw new Error("service-not-configured");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("service-not-configured");
  const credentials = value as Partial<ServiceAccountCredentials>;
  if (!credentials.client_email || !credentials.private_key) throw new Error("service-not-configured");
  return credentials as ServiceAccountCredentials;
}

export async function getGoogleAccessToken(scopes: string[]) {
  const now = Date.now();
  const cacheKey = scopeCacheKey(scopes);
  const cachedToken = cachedTokens.get(cacheKey);
  if (cachedToken && cachedToken.expiresAtMs > now + 60_000) return cachedToken.value;

  const credentials = serviceAccountCredentials();
  const tokenUri = credentials.token_uri || "https://oauth2.googleapis.com/token";
  const issuedAt = Math.floor(now / 1000);
  const key = await importPKCS8(credentials.private_key, "RS256");
  const assertion = await new SignJWT({ scope: cacheKey })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(credentials.client_email)
    .setSubject(credentials.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 3600)
    .sign(key);

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      assertion,
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`google-oauth-failed:${response.status}`);
  const result = await response.json() as { access_token?: unknown; expires_in?: unknown };
  if (typeof result.access_token !== "string" || !result.access_token) {
    throw new Error("google-oauth-empty-token");
  }
  const lifetimeSeconds = typeof result.expires_in === "number" && Number.isFinite(result.expires_in)
    ? Math.max(60, result.expires_in)
    : 3600;
  cachedTokens.set(cacheKey, {
    value: result.access_token,
    expiresAtMs: now + lifetimeSeconds * 1000,
  });
  return result.access_token;
}
