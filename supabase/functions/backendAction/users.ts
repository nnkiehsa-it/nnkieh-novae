import { asString } from "../_shared/http.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";

export function isUserAction(action: string) {
  return action === "recordPlatformVisit"
    || action === "getCurrentUserRole"
    || action === "cacheUserAvatar"
    || action === "getUserAvatarUrls";
}

export async function handleUserAction(
  action: string,
  payload: JsonRecord,
  auth: AuthContext,
  supabase: BackendSupabase,
) {
  if (action === "recordPlatformVisit") {
    const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
      uid: auth.uid,
      display_name: auth.name,
      photo_url: auth.photoUrl,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "uid" });
    if (error) throw error;
    return { success: true };
  }

  if (action === "getCurrentUserRole") {
    return { role: auth.isAdmin ? "admin" : "user" };
  }

  if (action === "cacheUserAvatar") {
    const photoURL = asString(payload.photoURL);
    const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
      uid: auth.uid,
      display_name: auth.name,
      photo_url: photoURL || auth.photoUrl,
      cached_photo_url: photoURL || auth.photoUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid" });
    if (error) throw error;
    return { photoUrl: photoURL || auth.photoUrl };
  }

  const uids = Array.isArray(payload.uids) ? payload.uids.map((uid) => asString(uid)).filter(Boolean).slice(0, 50) : [];
  const { data, error } = await supabase.schema("app_private").from("user_profiles").select("uid,cached_photo_url,photo_url").in("uid", uids);
  if (error) throw error;
  return {
    avatars: Object.fromEntries((data ?? []).map((profile) => [
      profile.uid,
      profile.cached_photo_url ?? profile.photo_url ?? null,
    ])),
  };
}
