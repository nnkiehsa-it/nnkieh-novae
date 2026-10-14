import type { PlatformDashboard } from '@shared/contracts/operations.ts';
import { callAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/backend-errors';
import { readRequestTimeoutMs } from '@/lib/request';
import { readQuery } from '@/lib/query-client';

export type { PlatformDashboard } from '@shared/contracts/operations.ts';

const DASHBOARD_MAX_AGE_MS = 10 * 60 * 1_000;

export function fetchPlatformDashboard(options: { forceRefresh?: boolean } = {}): Promise<PlatformDashboard> {
  return readQuery(['dashboard'], async ({ signal }) => {
    try {
      return await callAction('getPlatformDashboard', {}, { signal, timeoutMs: readRequestTimeoutMs });
    } catch (error) {
      throw toReadableBackendError(error);
    }
  }, options.forceRefresh ? 0 : DASHBOARD_MAX_AGE_MS);
}

/** Work that failed or is stuck, which someone has to look at. */
export function failingWork(dashboard: PlatformDashboard) {
  return dashboard.failedDeliveries + dashboard.failedPushDeliveries + dashboard.cleanupBacklog + dashboard.stuckUploads;
}
