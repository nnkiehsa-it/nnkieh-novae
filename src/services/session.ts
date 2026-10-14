import type { SessionBootstrap } from '@shared/contracts/session.ts';
import type { SessionAccess } from '@shared/contracts/users.ts';
import { callAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/backend-errors';
import { seedRuntimeSettings } from '@/services/runtime-settings';
import { queryClient } from '@/lib/query-client';

export type { PermissionCode, RoleCode, SessionAccess } from '@shared/contracts/users.ts';
export type SessionRole = SessionAccess['role'];

const BOOTSTRAP_KEY = ['session', 'bootstrap'] as const;
const ACCESS_KEY = ['session', 'access'] as const;
// Access read longer ago than this is not trusted to open the shell.
const ACCESS_MAX_AGE_MS = 10 * 60 * 1_000;
let pendingRecordVisit = false;
let pendingBootstrap: Promise<SessionBootstrap> | null = null;
let cachedSessionRole: SessionRole = 'user';

/** Display settings may use an older snapshot; access keeps its own short age. */
export function readSessionBootstrapSnapshot() {
  return queryClient.getQueryData<SessionBootstrap>(BOOTSTRAP_KEY) ?? null;
}

export function markSessionBootstrapStale() {
  void queryClient.invalidateQueries({ queryKey: BOOTSTRAP_KEY, refetchType: 'none' });
}

function freshSnapshot() {
  const state = queryClient.getQueryState<SessionBootstrap>(BOOTSTRAP_KEY);
  if (!state?.data || state.isInvalidated || Date.now() - state.dataUpdatedAt >= ACCESS_MAX_AGE_MS) return null;
  return state.data;
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
} = {}): Promise<SessionBootstrap> {
  if (options.force) markSessionBootstrapStale();
  if (options.recordVisit) pendingRecordVisit = true;

  // Visit recording is a side effect; never serve a cached response when a visit
  // must be written. Concurrent cold-start callers still share one in-flight request.
  if (!options.force && !options.refresh && !pendingRecordVisit) {
    const cached = freshSnapshot();
    if (cached?.access.setupCompleted) {
      seedRuntimeSettings(cached.runtime);
      return cached;
    }
  }

  // Not a cached query read: the answer streams, and who it is for is handed on before the rest.
  pendingBootstrap ??= (async () => {
    const shouldRecordVisit = pendingRecordVisit;
    pendingRecordVisit = false;
    const result = await callAction('getSessionBootstrap', { recordVisit: shouldRecordVisit }, {
      onSegment: (key, data) => {
        if (key === 'access') options.onAccess?.(data as SessionAccess);
      },
    });
    seedRuntimeSettings(result.runtime);
    queryClient.setQueryData(BOOTSTRAP_KEY, { ...result, visitRecorded: false });
    return result;
  })().finally(() => { pendingBootstrap = null; });
  return pendingBootstrap;
}

/** The role realtime topics are chosen by; it follows the last access stored. */
export function getCachedSessionRole() {
  return cachedSessionRole;
}

function sameMembers(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && [...left].sort().join('\n') === [...right].sort().join('\n');
}

function sameAccess(left: SessionAccess, right: SessionAccess) {
  return left.role === right.role
    && left.setupCompleted === right.setupCompleted
    && sameMembers(left.roles, right.roles)
    && sameMembers(left.permissions, right.permissions)
    && sameMembers(left.managedFacilityCategoryIds, right.managedFacilityCategoryIds)
    && sameMembers(left.managedIssueCategoryIds, right.managedIssueCategoryIds);
}

/**
 * Stores access the server answered. Returns whether it differs from the
 * access this device stored before, however old: everything else cached was
 * read under that access.
 */
export function storeSessionAccess(access: SessionAccess) {
  const previous = queryClient.getQueryData<SessionAccess>(ACCESS_KEY);
  cachedSessionRole = access.role;
  queryClient.setQueryData(ACCESS_KEY, access);
  return !previous || !sameAccess(previous, access);
}

/** Access this device read recently enough to open the shell before the server answers. */
export function readCachedSessionAccess(): SessionAccess | null {
  const state = queryClient.getQueryState<SessionAccess>(ACCESS_KEY);
  if (!state?.data || state.isInvalidated || Date.now() - state.dataUpdatedAt >= ACCESS_MAX_AGE_MS) return null;
  // Setup can be completed by another account while this one is away.
  if (!state.data.setupCompleted) return null;
  cachedSessionRole = state.data.role;
  return state.data;
}

/** Reads access from the server, past every cache. */
export async function fetchSessionAccess(): Promise<SessionAccess> {
  markSessionBootstrapStale();
  try {
    return await callAction('getCurrentUserRole', {});
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
