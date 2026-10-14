import type { PlatformDashboard } from '@shared/contracts/operations.ts';
import { callAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/issues-core';
import { getRouteRequestSignal } from '@/lib/route-request';
import { readRequestTimeoutMs } from '@/lib/request';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  getCachedContentPersistent,
  runCoalescedContentRequest,
  setCachedContentFromRead,
} from '@/services/content-read-cache';

export type { PlatformDashboard } from '@shared/contracts/operations.ts';

const DASHBOARD_CACHE_KEY = 'platform-dashboard-v2';

export async function fetchPlatformDashboard(options: { forceRefresh?: boolean } = {}): Promise<PlatformDashboard> {
  if (!options.forceRefresh) {
    const cached = await getCachedContentPersistent<PlatformDashboard>(DASHBOARD_CACHE_KEY, CONTENT_SHORT_CACHE_TTL_MS);
    if (cached) return cached;
  }
  return runCoalescedContentRequest(DASHBOARD_CACHE_KEY, async (cacheGuard) => {
    try {
      const data = await callAction('getPlatformDashboard', {}, {
        signal: getRouteRequestSignal(),
        timeoutMs: readRequestTimeoutMs,
      });
      setCachedContentFromRead(cacheGuard, data);
      return data;
    } catch (error) {
      throw toReadableBackendError(error);
    }
  });
}

/** Work that failed or is stuck, which someone has to look at. */
export function failingWork(dashboard: PlatformDashboard) {
  return dashboard.failedDeliveries + dashboard.failedPushDeliveries + dashboard.cleanupBacklog + dashboard.stuckUploads;
}
