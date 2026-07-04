import { requireEnv } from "./env.ts";

interface RateLimitWindow {
  expiresAt: Date;
  startsAt: Date;
}

interface RateLimitConfig {
  limit: number;
  message: string;
}

function rateLimitKey(uid: string, actionName: string, startsAt: Date) {
  return `srp:rate:${actionName}:${uid}:${startsAt.toISOString()}`;
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
  uid: string,
  actionName: string,
  window: RateLimitWindow,
  config: RateLimitConfig,
) {
  const restUrl = requireEnv("UPSTASH_REDIS_REST_URL").replace(/\/+$/u, "");
  const token = requireEnv("UPSTASH_REDIS_REST_TOKEN");
  const ttlSeconds = Math.max(1, Math.ceil((window.expiresAt.getTime() - Date.now()) / 1000));
  const key = rateLimitKey(uid, actionName, window.startsAt);

  const response = await fetch(`${restUrl}/pipeline`, {
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, ttlSeconds],
    ]),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("rate-limit-provider-unavailable");
  }

  const count = readPipelineResult(await response.json());
  if (count > config.limit) {
    throw new Error(config.message);
  }
}
