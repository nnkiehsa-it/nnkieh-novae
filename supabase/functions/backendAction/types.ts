import { createClient } from "npm:@supabase/supabase-js@2";

export type BackendSupabase = ReturnType<typeof createClient>;
export type JsonRecord = Record<string, unknown>;

export interface AuthContext {
  email: string;
  isAdmin: boolean;
  name: string;
  photoUrl: string | null;
  uid: string;
}
