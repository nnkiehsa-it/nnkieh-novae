import { ACTIONS, type ActionName } from "../../../../shared/actions.ts";
import type { ActionSpec } from "../../../../shared/contract.ts";
import { claimFixedWindowRateLimits, claimRateLimits, utcFixedWindow } from "../shared/business-rate-limit.ts";
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

export async function claimBackendActionBusinessLimit<N extends ActionName>(action: N, input: unknown, uid: string) {
  const spec: ActionSpec = ACTIONS[action];
  if (!spec.extraLimit) return;
  await claimRateLimits(uid, [{ name: spec.extraLimit, units: Math.max(1, spec.units?.(input) ?? 1) }]);
}

export async function claimBackendHealthcheckRateLimit() {
  await claimRateLimits("global", [{ name: "backendHealthcheckSecond" }, { name: "backendHealthcheckMinute" }]);
}
