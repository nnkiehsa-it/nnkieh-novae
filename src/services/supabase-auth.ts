import type { User } from 'firebase/auth';
import { getSupabaseClient, hasSupabaseConfig } from '@/lib/supabase';
import { withRequestTimeout } from '@/lib/request';
import { readSupabaseFunctionError } from '@/services/supabase-function-error';

interface SyncUserResponse {
  error?: string;
  ok?: boolean;
  role?: string;
}

const PROFILE_SYNC_INTERVAL_MS = 24 * 60 * 60 * 1_000;
const PROFILE_SYNC_KEY_PREFIX = 'novae:profile-synced-at:';

function wasRecentlySynced(uid: string) {
  try {
    const syncedAt = Number.parseInt(localStorage.getItem(`${PROFILE_SYNC_KEY_PREFIX}${uid}`) ?? '0', 10);
    return Number.isFinite(syncedAt) && Date.now() - syncedAt < PROFILE_SYNC_INTERVAL_MS;
  } catch {
    return false;
  }
}

function rememberSync(uid: string) {
  try {
    localStorage.setItem(`${PROFILE_SYNC_KEY_PREFIX}${uid}`, String(Date.now()));
  } catch {
    // A blocked storage API should not prevent authentication.
  }
}

export async function ensureSupabaseAuthenticatedRole(user: User) {
  if (!hasSupabaseConfig()) return;

  const token = await withRequestTimeout(
    () => user.getIdTokenResult(),
    { label: 'Supabase 登入初始化' },
  );
  if (token.claims.role === 'authenticated' && wasRecentlySynced(user.uid)) return;

  const client = getSupabaseClient();
  const { data, error, response } = await withRequestTimeout(
    () => client.functions.invoke<SyncUserResponse>('syncUser', {
      body: { email: user.email },
      headers: { Authorization: `Bearer ${token.token}` },
    }),
    { label: 'Supabase 登入初始化' },
  );

  if (error || data?.ok !== true) {
    throw new Error(error ? await readSupabaseFunctionError({ error, response }) : data?.error || 'Supabase 登入初始化失敗。');
  }
  rememberSync(user.uid);

  if (token.claims.role !== 'authenticated') {
    let refreshedToken = await withRequestTimeout(
      () => user.getIdTokenResult(true),
      { label: 'Supabase 登入更新' },
    );
    let attempts = 0;
    while (refreshedToken.claims.role !== 'authenticated' && attempts < 3) {
      await new Promise((resolve) => setTimeout(resolve, 800));
      refreshedToken = await withRequestTimeout(
        () => user.getIdTokenResult(true),
        { label: 'Supabase 登入更新重試' },
      );
      attempts++;
    }
    if (refreshedToken.claims.role !== 'authenticated') {
      throw new Error('Supabase 登入初始化尚未完成。');
    }
  }
}
