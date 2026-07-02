import type { User } from 'firebase/auth';
import { getSupabaseClient, hasSupabaseConfig } from '@/lib/supabase';
import { withRequestTimeout } from '@/lib/request';

interface SyncUserResponse {
  ok?: boolean;
  role?: string;
}

export async function ensureSupabaseAuthenticatedRole(user: User) {
  if (!hasSupabaseConfig()) {
    return;
  }

  const token = await withRequestTimeout(
    () => user.getIdTokenResult(),
    { label: 'Supabase 登入初始化' },
  );
  if (token.claims.role === 'authenticated') {
    return;
  }

  const client = getSupabaseClient();
  const { data, error } = await withRequestTimeout(
    () => client.functions.invoke<SyncUserResponse>('syncUser', {
      body: {
        email: user.email,
      },
    }),
    { label: 'Supabase 登入初始化' },
  );

  if (error || data?.ok !== true) {
    throw new Error(error?.message || 'Supabase 登入初始化失敗。');
  }

  const refreshedToken = await withRequestTimeout(
    () => user.getIdTokenResult(true),
    { label: 'Supabase 登入更新' },
  );
  if (refreshedToken.claims.role !== 'authenticated') {
    throw new Error('Supabase 登入初始化尚未完成。');
  }
}
