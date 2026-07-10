import { requireEnv } from "./env.ts";

interface RateLimitWindow {
  expiresAt: Date;
  startsAt: Date;
}

interface RateLimitConfig {
  limit: number;
  message: string;
}

interface RateLimitClaim {
  actionName: string;
  config: RateLimitConfig;
  identifier: string;
  window: RateLimitWindow;
}

function sanitizeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/gu, "_").slice(0, 160);
}

function rateLimitKey(identifier: string, actionName: string, startsAt: Date) {
  return `srp:rate:${sanitizeKeyPart(actionName)}:${sanitizeKeyPart(identifier)}:${startsAt.toISOString()}`;
}

function readPipelineCount(item: unknown) {
  if (!item || typeof item !== "object") throw new Error("rate-limit-provider-unavailable");
  const record = item as Record<string, unknown>;
  if (typeof record.error === "string") throw new Error("rate-limit-provider-unavailable");
  const result = record.result;
  if (typeof result === "number") return result;
  if (typeof result === "string") {
    const parsed = Number.parseInt(result, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export async function claimFixedWindowRateLimit(
  identifier: string,
  actionName: string,
  window: RateLimitWindow,
  config: RateLimitConfig,
) {
  await claimFixedWindowRateLimits([{ identifier, actionName, window, config }]);
}

export async function claimFixedWindowRateLimits(claims: RateLimitClaim[]) {
  if (claims.length === 0) return;
  const restUrl = requireEnv("UPSTASH_REDIS_REST_URL").replace(/\/+$/u, "");
  const token = requireEnv("UPSTASH_REDIS_REST_TOKEN");

  const response = await fetch(`${restUrl}/pipeline`, {
    body: JSON.stringify(claims.map((claim) => {
      const ttlSeconds = Math.max(1, Math.ceil((claim.window.expiresAt.getTime() - Date.now()) / 1000));
      return [
        "EVAL",
        "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return count",
        "1",
        rateLimitKey(claim.identifier, claim.actionName, claim.window.startsAt),
        String(ttlSeconds),
      ];
    })),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) {
    throw new Error("rate-limit-provider-unavailable");
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length !== claims.length) {
    throw new Error("rate-limit-provider-unavailable");
  }
  for (let index = 0; index < claims.length; index += 1) {
    const count = readPipelineCount(data[index]);
    if (count > claims[index].config.limit) {
      throw new Error(claims[index].config.message);
    }
  }
}

export function utcFixedWindow(milliseconds: number, date = new Date()) {
  const size = Math.max(1, Math.round(milliseconds));
  const startsAt = new Date(Math.floor(date.getTime() / size) * size);
  return {
    expiresAt: new Date(startsAt.getTime() + size),
    startsAt,
  };
}

export function utcMinuteWindow(date = new Date()) {
  return utcFixedWindow(60 * 1000, date);
}

export function utcHourWindow(date = new Date()) {
  return utcFixedWindow(60 * 60 * 1000, date);
}

export function utcSecondWindow(date = new Date()) {
  return utcFixedWindow(1000, date);
}
