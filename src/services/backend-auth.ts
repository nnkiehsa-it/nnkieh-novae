import type { User } from 'firebase/auth';
import { withRequestTimeout } from '@/lib/request';
import { apiGatewayUrl, hasApiGatewayConfig } from '@/lib/api-gateway';
import { ApiRequestError, type ApiErrorResponse } from '@/lib/api-error';
import { readLocalStorage, writeLocalStorage } from '@/lib/browser-storage';
import { backendSecurityHeaders } from '@/lib/backend-security';

interface SyncUserResponse extends ApiErrorResponse {
  ok?: boolean;
}

const PROFILE_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const PROFILE_SYNC_KEY_PREFIX = 'novae:profile-synced-at:';

function wasRecentlySynced(uid: string) {
  const syncedAt = Number.parseInt(readLocalStorage(`${PROFILE_SYNC_KEY_PREFIX}${uid}`) ?? '0', 10);
  return Number.isFinite(syncedAt) && Date.now() - syncedAt < PROFILE_SYNC_INTERVAL_MS;
}

function rememberSync(uid: string) {
  writeLocalStorage(`${PROFILE_SYNC_KEY_PREFIX}${uid}`, String(Date.now()));
}

async function syncBackendProfile(
  user: User,
  firebaseToken: string,
) {
  const response = await withRequestTimeout(
    async (signal) => fetch(apiGatewayUrl('/v1/auth/sync'), {
      method: 'POST',
      body: JSON.stringify({ email: user.email }),
      headers: {
        ...(await backendSecurityHeaders(firebaseToken)),
        'Content-Type': 'application/json',
      },
      signal,
    }),
    { label: 'auth.backendLoginInitialization' },
  );
  let data: SyncUserResponse | null = null;
  try {
    data = await response.json() as SyncUserResponse;
  } catch {
    // Use the HTTP fallback below.
  }
  return { data, response };
}

function syncRequestError(data: SyncUserResponse | null) {
  return new ApiRequestError(data ?? { error: { code: 'upstream-invalid-response' } });
}

export async function ensureBackendProfile(
  user: User,
) {
  if (!hasApiGatewayConfig()) return;
  if (wasRecentlySynced(user.uid)) return;

  const token = await withRequestTimeout(
    () => user.getIdTokenResult(),
    { label: 'auth.backendLoginInitialization' },
  );

  const result = await syncBackendProfile(user, token.token);

  if (!result.response.ok || result.data?.ok !== true) {
    throw syncRequestError(result.data);
  }
  rememberSync(user.uid);
}
