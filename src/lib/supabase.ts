import { createClient } from '@supabase/supabase-js';
import { auth } from '@/lib/firebase';

const supabaseUrl = readEnv('VITE_SUPABASE_URL');
const supabasePublishableKey = readEnv('VITE_SUPABASE_PUBLISHABLE_KEY');

function readEnv(name: string) {
  return String(import.meta.env[name as keyof ImportMetaEnv] ?? '').trim();
}

type SupabaseAppClient = ReturnType<typeof createClient<any, 'app_api'>>;

let supabaseClient: SupabaseAppClient | null = null;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Supabase 設定尚未完成。');
  }

  const client = supabaseClient ?? createClient<any, 'app_api'>(supabaseUrl, supabasePublishableKey, {
    accessToken: async () => auth?.currentUser?.getIdToken() ?? null,
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
