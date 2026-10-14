import type { ApiErrorCode } from "../../../../shared/api-errors.ts";
import { RATE_LIMITS, type RateLimitName, type RateLimitWindow } from "../../../../shared/rate-limits.ts";
import { currentEnvironment } from "./env.ts";
import { operationPolicy } from "./operation-policies.ts";
import type { DurableRateLimitClaim } from "../../durable/business-rate-limiter";
import { RateLimitError, rateLimitsDisabled } from "../../rate-limit";

interface FixedWindow {
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
  window: FixedWindow;
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
  window: FixedWindow,
  config: RateLimitConfig,
) {
  await claimFixedWindowRateLimits([{ identifier, actionName, window, config }]);
}

const TAIPEI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

function taipeiDayWindow(date = new Date()): FixedWindow {
  const shifted = new Date(date.getTime() + TAIPEI_UTC_OFFSET_MS);
  const startMs = Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - TAIPEI_UTC_OFFSET_MS;
  return { expiresAt: new Date(startMs + 24 * 60 * 60 * 1000), startsAt: new Date(startMs) };
}

const WINDOWS: Record<RateLimitWindow, () => FixedWindow> = {
  second: () => utcSecondWindow(),
  minute: () => utcMinuteWindow(),
  hour: () => utcHourWindow(),
  "taipei-day": () => taipeiDayWindow(),
};

/** Counts against named business limits; the limit in force is the runtime policy of the same name. */
export async function claimRateLimits(identifier: string, claims: Array<{ name: RateLimitName; units?: number }>) {
  await claimFixedWindowRateLimits(claims.map(({ name, units }) => {
    const { counter, errorCode, window } = RATE_LIMITS[name];
    return { actionName: counter, config: { errorCode, limit: operationPolicy(name) }, identifier, units, window: WINDOWS[window]() };
  }));
}

export async function claimFixedWindowRateLimits(claims: RateLimitClaim[]) {
  if (claims.length === 0) return;
  if (rateLimitsDisabled(currentEnvironment())) return;
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

export function utcFixedWindow(milliseconds: number, date = new Date()): FixedWindow {
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

function utcSecondWindow(date = new Date()) {
  return utcFixedWindow(1000, date);
}
