import { createClient } from '@supabase/supabase-js';
import { getFirebaseIdToken } from '@/lib/auth-token';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabasePublishableKey = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim();

type SupabaseAppClient = ReturnType<typeof createClient<any, 'app_api'>>;

let supabaseClient: SupabaseAppClient | null = null;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Supabase 設定尚未完成。');
  }

  const client = supabaseClient ?? createClient<any, 'app_api'>(supabaseUrl, supabasePublishableKey, {
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

export { supabasePublishableKey, supabaseUrl };
