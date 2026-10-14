import type { SessionAccess } from '@shared/contracts/users.ts';
import { callAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/issues-core';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  runCoalescedContentRequest,
  setCachedContent,
  setCachedContentFromRead,
} from '@/services/content-read-cache';
import { fetchSessionBootstrap, markSessionBootstrapStale } from '@/services/session-bootstrap';

export type { PermissionCode, RoleCode, SessionAccess } from '@shared/contracts/users.ts';
export type SessionRole = SessionAccess['role'];
let cachedSessionRole: SessionRole = 'user';
const SESSION_ACCESS_CACHE_KEY = 'current-session-access-v2';

export function getCachedSessionRole() {
  return cachedSessionRole;
}

export function seedSessionAccess(access: SessionAccess, options: { persist?: boolean } = {}) {
  cachedSessionRole = access.role;
  if (options.persist !== false) setCachedContent(SESSION_ACCESS_CACHE_KEY, access);
  return access;
}

export async function readCachedSessionAccess(): Promise<SessionAccess | null> {
  const cached = await getCachedContentPersistent<SessionAccess>(
    SESSION_ACCESS_CACHE_KEY,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  // Setup can be completed by another account while this one is away.
  if (!cached?.setupCompleted) return null;
  return seedSessionAccess(cached, { persist: false });
}

export async function fetchCurrentUserRole(
  force = false,
): Promise<SessionAccess> {
  if (force) {
    markContentCachePrefixStale(SESSION_ACCESS_CACHE_KEY);
    markSessionBootstrapStale();
  }
  const cached = force ? null : await readCachedSessionAccess();
  // An incomplete setup is a transient global state. Never let one user's
  // persistent session cache keep the platform locked after another user
  // completes setup.
  if (cached) return cached;

  // Prefer the combined bootstrap so cold starts share one Edge invocation with
  // catalog / versions / unread (see session-bootstrap).
  if (!force) {
    const bootstrap = await fetchSessionBootstrap();
    return seedSessionAccess(bootstrap.access);
  }

  return runCoalescedContentRequest(SESSION_ACCESS_CACHE_KEY, async (cacheGuard) => {
    try {
      const access = seedSessionAccess(await callAction('getCurrentUserRole', {}));
      setCachedContentFromRead(cacheGuard, access);
      return access;
    } catch (error) {
      throw toReadableBackendError(error);
    }
  });
}
