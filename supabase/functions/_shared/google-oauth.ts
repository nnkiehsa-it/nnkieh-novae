import { GoogleAuth } from "npm:google-auth-library@10";
import { requireEnv } from "./env.ts";

interface CachedToken {
  expiresAtMs: number;
  value: string;
}

const cachedTokens = new Map<string, CachedToken>();

function scopeCacheKey(scopes: string[]) {
  return [...new Set(scopes)].sort().join(" ");
}

export async function getGoogleAccessToken(scopes: string[]) {
  const now = Date.now();
  const cacheKey = scopeCacheKey(scopes);
  const cachedToken = cachedTokens.get(cacheKey);
  if (cachedToken && cachedToken.expiresAtMs > now + 60_000) {
    return cachedToken.value;
  }

  const credentials = JSON.parse(requireEnv("GOOGLE_SERVICE_ACCOUNT_JSON"));
  const auth = new GoogleAuth({
    credentials,
    scopes,
  });
  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;
  if (!token) {
    throw new Error("Google access token is empty.");
  }

  cachedTokens.set(cacheKey, {
    value: token,
    expiresAtMs: now + 55 * 60 * 1000,
  });
  return token;
}
