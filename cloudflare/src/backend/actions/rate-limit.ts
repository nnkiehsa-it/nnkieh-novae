import { ACTIONS, type ActionName } from "../../../../shared/actions.ts";
import { claimFixedWindowRateLimits, claimRateLimits, utcFixedWindow } from "../shared/business-rate-limit.ts";
import type { RateLimitName } from "../../../../shared/rate-limits.ts";
import type { JsonRecord } from "./types.ts";
import { operationPolicy } from "../shared/operation-policies.ts";

const BURST_POLICIES = {
  read: "readBurst",
  "general-write": "writeBurst",
  "sensitive-write": "sensitiveBurst",
  "admin-write": "adminBurst",
  "upload-write": "uploadBurst",
  "upload-resolve": "resolveBurst",
} as const;

export async function claimBackendActionBurstLimit(action: ActionName, uid: string) {
  const { group } = ACTIONS[action];
  await claimFixedWindowRateLimits([{ identifier: uid, actionName: `burst.${group}`,
    window: utcFixedWindow(10_000), config: { limit: operationPolicy(BURST_POLICIES[group]), errorCode: "rate-limit.operation" } }]);
}

export async function claimBackendActionBusinessLimit(action: ActionName, payload: JsonRecord, uid: string) {
  const policy: { extraLimit?: RateLimitName; countsImages?: true } = ACTIONS[action];
  if (!policy.extraLimit) return;
  const units = policy.countsImages && Array.isArray(payload.images) ? Math.max(1, payload.images.length) : 1;
  await claimRateLimits(uid, [{ name: policy.extraLimit, units }]);
}

export async function claimBackendHealthcheckRateLimit() {
  await claimRateLimits("global", [{ name: "backendHealthcheckSecond" }, { name: "backendHealthcheckMinute" }]);
}
