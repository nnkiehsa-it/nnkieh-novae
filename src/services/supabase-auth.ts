import type { User } from 'firebase/auth';
import { hasSupabaseConfig } from '@/lib/supabase';
import { clearFirebaseIdTokenCache } from '@/lib/auth-token';
import { withRequestTimeout } from '@/lib/request';
import { apiGatewayUrl, hasApiGatewayConfig } from '@/lib/api-gateway';
import { ApiRequestError, type ApiErrorResponse } from '@/lib/api-error';
import { readLocalStorage, writeLocalStorage } from '@/lib/browser-storage';

interface SyncUserResponse extends ApiErrorResponse {
  ok?: boolean;
  role?: string;
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

export async function ensureSupabaseAuthenticatedRole(user: User) {
  if (!hasSupabaseConfig() || !hasApiGatewayConfig()) return;

  const token = await withRequestTimeout(
    () => user.getIdTokenResult(),
    { label: 'auth.supabaseLoginInitialization' },
  );
  if (token.claims.role === 'authenticated' && wasRecentlySynced(user.uid)) return;

  const response = await withRequestTimeout(
    (signal) => fetch(apiGatewayUrl('/v1/auth/sync'), {
      method: 'POST',
      body: JSON.stringify({ email: user.email }),
      headers: {
        Authorization: `Bearer ${token.token}`,
        'Content-Type': 'application/json',
      },
      signal,
    }),
    { label: 'auth.supabaseLoginInitialization' },
  );
  let data: SyncUserResponse | null = null;
  try {
    data = await response.json() as SyncUserResponse;
  } catch {
    // Use the HTTP fallback below.
  }

  if (!response.ok || data?.ok !== true) {
    throw new ApiRequestError(data ?? { error: { code: 'upstream-invalid-response' } });
  }
  rememberSync(user.uid);

  if (token.claims.role !== 'authenticated') {
    let refreshedToken = await withRequestTimeout(
      () => user.getIdTokenResult(true),
      { label: 'auth.supabaseLoginUpdate' },
    );
    let attempts = 0;
    while (refreshedToken.claims.role !== 'authenticated' && attempts < 3) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      refreshedToken = await withRequestTimeout(
        () => user.getIdTokenResult(true),
        { label: 'common.refreshingSupabaseSignIn' },
      );
      attempts++;
    }
    if (refreshedToken.claims.role !== 'authenticated') {
      throw new Error('auth.supabaseLoginInitializationHasNotBeenCompleted');
    }
    // The force-refreshed Firebase token now carries the authenticated role.
    // Drop the app-level copy so Realtime cannot reuse the pre-sync token.
    clearFirebaseIdTokenCache();
  }
}
