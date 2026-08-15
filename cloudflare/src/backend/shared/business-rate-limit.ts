import type { ApiErrorCode } from "./api-errors.ts";
import { currentEnvironment } from "./env.ts";
import type { DurableRateLimitClaim } from "../../durable/business-rate-limiter";

interface RateLimitWindow {
  expiresAt: Date;
  startsAt: Date;
}

interface RateLimitConfig {
  errorCode: ApiErrorCode;
  limit: number;
}

interface RateLimitClaim {
  actionName: string;
  config: RateLimitConfig;
  identifier: string;
  units?: number;
  window: RateLimitWindow;
}

export class RateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(code: ApiErrorCode, retryAfterSeconds: number) {
    super(code);
    this.name = "RateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function sanitizeKeyPart(value: string) {
  return value.replace(/[^a-zA-Z0-9_.:-]/gu, "_").slice(0, 160);
}

function rateLimitKey(actionName: string, startsAt: Date) {
  return `${sanitizeKeyPart(actionName)}:${startsAt.toISOString()}`;
}

export async function claimFixedWindowRateLimit(
  identifier: string,
  actionName: string,
  window: RateLimitWindow,
  config: RateLimitConfig,
) {
  await claimFixedWindowRateLimits([{ identifier, actionName, window, config }]);
}

export async function claimFixedWindowRateLimitUnits(
  identifier: string,
  actionName: string,
  window: RateLimitWindow,
  config: RateLimitConfig,
  units: number,
) {
  await claimFixedWindowRateLimits([{ identifier, actionName, window, config, units }]);
}

export async function claimFixedWindowRateLimits(claims: RateLimitClaim[]) {
  if (claims.length === 0) return;
  const groups = Map.groupBy(claims, (claim) => claim.identifier);
  for (const [identifier, group] of groups) {
    const durableClaims: DurableRateLimitClaim[] = group.map((claim) => ({
      errorCode: claim.config.errorCode,
      expiresAtMs: claim.window.expiresAt.getTime(),
      key: rateLimitKey(claim.actionName, claim.window.startsAt),
      limit: claim.config.limit,
      units: Math.max(1, Math.round(claim.units ?? 1)),
    }));
    const result = await currentEnvironment().BUSINESS_RATE_LIMITS.getByName(identifier).claim(durableClaims);
    if (!result.success) {
      throw new RateLimitError(
        (result.errorCode || "rate-limit.operation") as ApiErrorCode,
        result.retryAfterSeconds ?? 1,
      );
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
