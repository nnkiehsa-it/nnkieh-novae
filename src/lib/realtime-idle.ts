export const REALTIME_IDLE_TIMEOUT_MS = 30 * 60 * 1_000;

export function realtimeIdleRemaining(
  lastActivityAt: number,
  now = Date.now(),
) {
  return Math.max(0, REALTIME_IDLE_TIMEOUT_MS - (now - lastActivityAt));
}
