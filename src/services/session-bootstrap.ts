import { invokeBackendAction } from '@/services/backend-action';
import type { CategoryCatalog } from '@/types/categories';
import type { SessionAccess } from '@/services/session-role';
import { seedRuntimeSettings } from '@/services/runtime-settings';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  runCoalescedContentRequest,
  setCachedContentFromRead,
} from '@/services/content-read-cache';

export type ContentVersionDomain = 'announcements' | 'facilities' | 'issues';
export type ContentVersions = Record<ContentVersionDomain, number>;

export interface SessionBootstrapResult {
  access: SessionAccess;
  catalog: CategoryCatalog;
  notificationUnread: { hasUnread: boolean };
  runtime: { pushTokenConfirmationDays: number };
  versions: ContentVersions;
  visitRecorded: boolean;
}

function normalizeAccess(access: Partial<SessionAccess> | undefined): SessionAccess {
  return {
    role: access?.role === 'admin' ? 'admin' : 'user',
    roles: Array.isArray(access?.roles) ? access.roles : [],
    permissions: Array.isArray(access?.permissions) ? access.permissions : [],
    managedIssueCategoryIds: Array.isArray(access?.managedIssueCategoryIds)
      ? access.managedIssueCategoryIds
      : [],
    managedFacilityCategoryIds: Array.isArray(access?.managedFacilityCategoryIds)
      ? access.managedFacilityCategoryIds
      : [],
    setupCompleted: access?.setupCompleted === true,
  };
}

const SESSION_BOOTSTRAP_CACHE_KEY = 'session-bootstrap-v2';
let pendingRecordVisit = false;

/** Display settings may use an older snapshot; access still uses its short TTL. */
export function readSessionBootstrapSnapshot() {
  return getCachedContentPersistent<SessionBootstrapResult>(SESSION_BOOTSTRAP_CACHE_KEY);
}

export function markSessionBootstrapStale() {
  markContentCachePrefixStale(SESSION_BOOTSTRAP_CACHE_KEY);
}

/**
 * What the session starts on. Who the visitor is and what they may do leaves
 * the Worker before either of its reads does, so `onAccess` is called with it
 * while the catalog is still arriving and the shell can be drawn against it.
 */
export async function fetchSessionBootstrap(options: {
  force?: boolean;
  refresh?: boolean;
  onAccess?: (access: SessionAccess) => void;
  recordVisit?: boolean;
} = {}): Promise<SessionBootstrapResult> {
  const force = options.force === true;
  const recordVisit = options.recordVisit === true;
  if (force) markSessionBootstrapStale();
  if (recordVisit) pendingRecordVisit = true;

  // Visit recording is a side effect; never serve a cached response when a visit
  // must be written. Concurrent cold-start callers still share one in-flight request.
  // A background refresh keeps the persisted snapshot usable by the shell and
  // catalog readers while new access is being reconciled with the server.
  if (!force && !options.refresh && !pendingRecordVisit) {
    const cached = await getCachedContentPersistent<SessionBootstrapResult>(
      SESSION_BOOTSTRAP_CACHE_KEY,
      CONTENT_SHORT_CACHE_TTL_MS,
    );
    if (cached?.access?.setupCompleted) {
      seedRuntimeSettings(cached.runtime);
      return cached;
    }
  }

  return runCoalescedContentRequest(SESSION_BOOTSTRAP_CACHE_KEY, async (cacheGuard) => {
    const shouldRecordVisit = pendingRecordVisit;
    pendingRecordVisit = false;
    const result = await invokeBackendAction<
      { recordVisit?: boolean },
      SessionBootstrapResult
    >('getSessionBootstrap', {
      onSegment: (key, data) => {
        if (key === 'access') options.onAccess?.(normalizeAccess(data as Partial<SessionAccess>));
      },
    })({
      ...(shouldRecordVisit ? { recordVisit: true } : {}),
    });
    const normalized: SessionBootstrapResult = {
      ...result,
      access: normalizeAccess(result.access),
    };
    seedRuntimeSettings(normalized.runtime);
    setCachedContentFromRead(cacheGuard, { ...normalized, visitRecorded: false });
    return normalized;
  });
}
