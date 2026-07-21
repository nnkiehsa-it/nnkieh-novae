import { invokeBackendAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/issues-core';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  runCoalescedContentRequest,
  setCachedContentFromRead,
} from '@/services/content-read-cache';

export type SessionRole = 'admin' | 'user';
export type RoleCode = 'platform-admin' | 'proposal-manager' | 'announcement-manager' | 'general-affairs';
export type PermissionCode = 'proposal.manage' | 'announcement.manage' | 'category.manage' | 'facility.manage' | 'role.manage' | 'dashboard.view';
export interface SessionAccess {
  role: SessionRole;
  roles: RoleCode[];
  permissions: PermissionCode[];
  managedIssueCategoryIds: string[];
  managedFacilityCategoryIds: string[];
  setupCompleted: boolean;
}
let cachedSessionRole: SessionRole = 'user';
const SESSION_ACCESS_CACHE_KEY = 'current-session-access-v2';

export function getCachedSessionRole() {
  return cachedSessionRole;
}

export async function fetchCurrentUserRole(force = false): Promise<SessionAccess> {
  if (force) markContentCachePrefixStale(SESSION_ACCESS_CACHE_KEY);
  const cached = force ? null : await getCachedContentPersistent<SessionAccess>(
    SESSION_ACCESS_CACHE_KEY,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  // An incomplete setup is a transient global state. Never let one user's
  // persistent session cache keep the platform locked after another user
  // completes setup.
  if (cached?.setupCompleted) {
    cachedSessionRole = cached.role;
    return cached;
  }

  return runCoalescedContentRequest(SESSION_ACCESS_CACHE_KEY, async (cacheGuard) => {
    try {
      const result = await invokeBackendAction<Record<string, never>, SessionAccess>('getCurrentUserRole')({});
      cachedSessionRole = result.role === 'admin' ? 'admin' : 'user';
      const access = {
        role: cachedSessionRole,
        roles: Array.isArray(result.roles) ? result.roles : [],
        permissions: Array.isArray(result.permissions) ? result.permissions : [],
        managedIssueCategoryIds: Array.isArray(result.managedIssueCategoryIds) ? result.managedIssueCategoryIds : [],
        managedFacilityCategoryIds: Array.isArray(result.managedFacilityCategoryIds) ? result.managedFacilityCategoryIds : [],
        setupCompleted: result.setupCompleted === true,
      };
      setCachedContentFromRead(cacheGuard, access);
      return access;
    } catch (error) {
      throw toReadableBackendError(error);
    }
  });
}
