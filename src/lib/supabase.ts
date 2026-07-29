import { createClient } from '@supabase/supabase-js';
import { getFirebaseIdToken } from '@/lib/auth-token';
import type { Database } from '../../supabase/functions/_shared/database';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabasePublishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

type SupabaseAppClient = ReturnType<typeof createClient<Database, 'app_api'>>;

let supabaseClient: SupabaseAppClient | null = null;
let realtimeAuthPromise: Promise<boolean> | null = null;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('settings.supabaseSettingsHaveNotBeenCompleted');
  }

  const client = supabaseClient ?? createClient<Database, 'app_api'>(supabaseUrl, supabasePublishableKey, {
    accessToken: getFirebaseIdToken,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    db: {
      schema: 'app_api',
    },
  });
  supabaseClient = client;

  return client;
}

export function hasSupabaseConfig() {
  return Boolean(supabaseUrl && supabasePublishableKey);
}

/**
 * Private Broadcast authorization must finish before a channel joins. The
 * Supabase client starts its access-token callback eagerly, but a channel can
 * otherwise race that asynchronous Firebase token load during app startup.
 */
export function authorizeSupabaseRealtime() {
  if (realtimeAuthPromise) return realtimeAuthPromise;
  const client = getSupabaseClient();
  const pending = getFirebaseIdToken()
    .then(async (token) => {
      if (!token) return false;
      // No explicit token keeps the accessToken callback active for refreshes.
      await client.realtime.setAuth();
      return true;
    })
    .finally(() => {
      if (realtimeAuthPromise === pending) realtimeAuthPromise = null;
    });
  realtimeAuthPromise = pending;
  return pending;
}

export { supabasePublishableKey, supabaseUrl };
