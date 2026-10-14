import type { SessionBootstrap } from '@shared/contracts/session.ts';
import type { SessionAccess } from '@shared/contracts/users.ts';
import { callAction } from '@/services/backend-action';
import { seedRuntimeSettings } from '@/services/runtime-settings';
import { queryClient } from '@/lib/query-client';

type SessionBootstrapResult = SessionBootstrap;

export const SESSION_SHORT_MAX_AGE_MS = 10 * 60 * 1_000;
const BOOTSTRAP_KEY = ['session', 'bootstrap'] as const;
let pendingRecordVisit = false;
let pendingBootstrap: Promise<SessionBootstrapResult> | null = null;

/** Display settings may use an older snapshot; access still uses its short age. */
export function readSessionBootstrapSnapshot() {
  return queryClient.getQueryData<SessionBootstrapResult>(BOOTSTRAP_KEY) ?? null;
}

export function markSessionBootstrapStale() {
  void queryClient.invalidateQueries({ queryKey: BOOTSTRAP_KEY, refetchType: 'none' });
}

function freshSnapshot() {
  const state = queryClient.getQueryState<SessionBootstrapResult>(BOOTSTRAP_KEY);
  if (!state?.data || state.isInvalidated || Date.now() - state.dataUpdatedAt >= SESSION_SHORT_MAX_AGE_MS) return null;
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
