import type { SessionAccess } from '@shared/contracts/users.ts';
import { callAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/backend-errors';
import { queryClient } from '@/lib/query-client';
import { fetchSessionBootstrap, markSessionBootstrapStale, SESSION_SHORT_MAX_AGE_MS } from '@/services/session-bootstrap';

export type { PermissionCode, RoleCode, SessionAccess } from '@shared/contracts/users.ts';
export type SessionRole = SessionAccess['role'];
let cachedSessionRole: SessionRole = 'user';
const ACCESS_KEY = ['session', 'access'] as const;

export function getCachedSessionRole() {
  return cachedSessionRole;
}

export function seedSessionAccess(access: SessionAccess) {
  cachedSessionRole = access.role;
  queryClient.setQueryData(ACCESS_KEY, access);
  return access;
}

export function readCachedSessionAccess(): SessionAccess | null {
  const state = queryClient.getQueryState<SessionAccess>(ACCESS_KEY);
  if (!state?.data || state.isInvalidated || Date.now() - state.dataUpdatedAt >= SESSION_SHORT_MAX_AGE_MS) return null;
  // Setup can be completed by another account while this one is away.
  if (!state.data.setupCompleted) return null;
  cachedSessionRole = state.data.role;
  return state.data;
}

export async function fetchCurrentUserRole(force = false): Promise<SessionAccess> {
  if (force) {
    void queryClient.invalidateQueries({ queryKey: ACCESS_KEY, refetchType: 'none' });
    markSessionBootstrapStale();
    try {
      return seedSessionAccess(await callAction('getCurrentUserRole', {}));
    } catch (error) {
      throw toReadableBackendError(error);
    }
  }
  // An incomplete setup is a transient global state. Never let one user's
  // persisted session keep the platform locked after another user completes setup.
  const cached = readCachedSessionAccess();
  if (cached) return cached;
  // The combined bootstrap lets a cold start share one Worker invocation with
  // the catalog, versions and unread state.
  return seedSessionAccess((await fetchSessionBootstrap()).access);
}
