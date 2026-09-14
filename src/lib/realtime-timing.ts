import { getOperationPolicy } from '@/lib/operation-policies';

export function realtimeIdleRemaining(
  lastActivityAt: number,
  now = Date.now(),
) {
  return Math.max(0, getOperationPolicy('realtimeIdleMinutes') * 60000 - (now - lastActivityAt));
}

export function realtimeHeartbeatInterval() {
  return getOperationPolicy('realtimeHeartbeatSeconds') * 1000;
}
