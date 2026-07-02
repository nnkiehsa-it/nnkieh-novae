import { invokeBackendAction } from '@/services/backend-action';
import { toReadableBackendError } from '@/services/issues-core';

export type SessionRole = 'admin' | 'user';

export async function fetchCurrentUserRole(): Promise<SessionRole> {
  try {
    const fn = invokeBackendAction<Record<string, never>, { role: SessionRole }>('getCurrentUserRole');
    const result = await fn({});
    return result.data.role === 'admin' ? 'admin' : 'user';
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
