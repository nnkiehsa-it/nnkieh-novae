import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import {
  claimFixedWindowRateLimits,
  utcHourWindow,
  utcMinuteWindow,
  utcSecondWindow,
} from "../_shared/upstash-rate-limit.ts";
import type { BackendActionDefinition } from "./action-registry.ts";

export async function claimBackendActionRateLimit(uid: string, definition: BackendActionDefinition) {
  const action = definition.name;
  let limits;
  switch (definition.rateLimitGroup) {
    case "read":
      limits = { prefix: "backend.read", second: RATE_LIMITS.backendActionReadSecond, hourly: RATE_LIMITS.backendActionReadHourly };
      break;
    case "general-write":
      limits = { prefix: "backend.write", second: RATE_LIMITS.backendActionWriteSecond, hourly: RATE_LIMITS.backendActionWriteHourly };
      break;
    case "upload-resolve":
      limits = { prefix: "backend.upload-resolve", second: RATE_LIMITS.backendActionUploadResolveSecond, hourly: RATE_LIMITS.backendActionUploadResolveHourly };
      break;
    case "admin-write":
      limits = { prefix: "backend.admin-write", second: RATE_LIMITS.backendActionAdminWriteSecond, hourly: RATE_LIMITS.backendActionAdminWriteHourly };
      break;
    case "sensitive-write":
      limits = { prefix: "backend.sensitive-write", second: RATE_LIMITS.backendActionSensitiveWriteSecond, hourly: RATE_LIMITS.backendActionSensitiveWriteHourly };
      break;
  }
  await claimFixedWindowRateLimits([
    { identifier: uid, actionName: `${limits.prefix}.${action}.second`, window: utcSecondWindow(), config: limits.second },
    { identifier: uid, actionName: `${limits.prefix}.${action}`, window: utcHourWindow(), config: limits.hourly },
  ]);
}

export async function claimBackendHealthcheckRateLimit() {
  await claimFixedWindowRateLimits([
    { identifier: "global", actionName: "backend.healthcheck.second", window: utcSecondWindow(), config: RATE_LIMITS.backendHealthcheckSecond },
    { identifier: "global", actionName: "backend.healthcheck", window: utcMinuteWindow(), config: RATE_LIMITS.backendHealthcheckMinute },
  ]);
}
