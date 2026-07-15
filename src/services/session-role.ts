import { invokeBackendAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/issues-core';

export type SessionRole = 'admin' | 'user';
let cachedSessionRole: SessionRole = 'user';

export function getCachedSessionRole() {
  return cachedSessionRole;
}

export async function fetchCurrentUserRole(): Promise<SessionRole> {
  cachedSessionRole = 'user';
  try {
    const fn = invokeBackendAction<Record<string, never>, { role: SessionRole }>('getCurrentUserRole');
    const result = await fn({});
    cachedSessionRole = result.role === 'admin' ? 'admin' : 'user';
    return cachedSessionRole;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
