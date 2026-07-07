import { requireEnv } from "./env.ts";

interface RateLimitWindow {
  expiresAt: Date;
  startsAt: Date;
}

interface RateLimitConfig {
  limit: number;
  message: string;
}

function sanitizeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/gu, "_").slice(0, 160);
}

function rateLimitKey(identifier: string, actionName: string, startsAt: Date) {
  return `srp:rate:${sanitizeKeyPart(actionName)}:${sanitizeKeyPart(identifier)}:${startsAt.toISOString()}`;
}

function readPipelineResult(data: unknown) {
  if (!Array.isArray(data)) return 0;
  const error = data.find((item) =>
    item && typeof item === "object" && typeof (item as Record<string, unknown>).error === "string"
  );
  if (error) throw new Error("rate-limit-provider-unavailable");
  const first = data[0];
  if (!first || typeof first !== "object") return 0;
  const result = (first as Record<string, unknown>).result;
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
  const restUrl = requireEnv("UPSTASH_REDIS_REST_URL").replace(/\/+$/u, "");
  const token = requireEnv("UPSTASH_REDIS_REST_TOKEN");
  const ttlSeconds = Math.max(1, Math.ceil((window.expiresAt.getTime() - Date.now()) / 1000));
  const key = rateLimitKey(identifier, actionName, window.startsAt);

  const response = await fetch(`${restUrl}/pipeline`, {
    body: JSON.stringify([
      [
        "EVAL",
        "local count=redis.call('INCR',KEYS[1]); if count==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return count",
        "1",
        key,
        String(ttlSeconds),
      ],
    ]),
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

  const count = readPipelineResult(await response.json());
  if (count > config.limit) {
    throw new Error(config.message);
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
