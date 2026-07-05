import {
  createCloudinaryAuthenticatedImageUrl,
  sha256Hex,
  uploadCloudinaryAuthenticatedImageFromUrl,
} from "../_shared/cloudinary.ts";
import { asString } from "../_shared/http.ts";
import { RATE_LIMITS } from "../_shared/rate-limits.ts";
import { claimFixedWindowRateLimit } from "../_shared/upstash-rate-limit.ts";
import type { AuthContext, BackendSupabase, JsonRecord } from "./types.ts";
import { taipeiDayWindow } from "./utils.ts";

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
    await claimFixedWindowRateLimit(auth.uid, "avatar.cache", taipeiDayWindow(), RATE_LIMITS.avatarCacheDaily);
    const photoURL = asString(payload.photoURL);
    const sourceUrl = photoURL || auth.photoUrl;
    if (!sourceUrl) return { photoUrl: null };

    const { data: existing, error: existingError } = await supabase
      .schema("app_private")
      .from("user_profiles")
      .select("avatar_hash,avatar_public_id,avatar_source_url,avatar_version,cached_photo_url")
      .eq("uid", auth.uid)
      .maybeSingle();
    if (existingError) throw existingError;

    const imageResponse = await fetch(sourceUrl);
    if (!imageResponse.ok) {
      throw new Error(`avatar-fetch-failed:${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const avatarHash = await sha256Hex(imageBuffer);
    if (existing?.avatar_hash === avatarHash && existing.cached_photo_url) {
      const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
        uid: auth.uid,
        avatar_source_url: sourceUrl,
        display_name: auth.name,
        photo_url: sourceUrl,
        updated_at: new Date().toISOString(),
      }, { onConflict: "uid" });
      if (error) throw error;
      return { photoUrl: existing.cached_photo_url };
    }

    const nextVersion = Number(existing?.avatar_version ?? 0) + 1;
    const nextPublicId = `srp/avatars/${auth.uid}_${nextVersion}`;
    await uploadCloudinaryAuthenticatedImageFromUrl(nextPublicId, sourceUrl);
    const cachedPhotoUrl = await createCloudinaryAuthenticatedImageUrl(nextPublicId);
    const previousPublicId = asString(existing?.avatar_public_id);

    const { error } = await supabase.schema("app_private").from("user_profiles").upsert({
      uid: auth.uid,
      avatar_hash: avatarHash,
      avatar_public_id: nextPublicId,
      avatar_source_url: sourceUrl,
      avatar_version: nextVersion,
      display_name: auth.name,
      photo_url: sourceUrl,
      cached_photo_url: cachedPhotoUrl,
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid" });
    if (error) throw error;
    if (previousPublicId && previousPublicId !== nextPublicId) {
      await supabase.schema("app_private").from("deletion_jobs").insert({
        cloudinary_public_id: previousPublicId,
        target_id: auth.uid,
        target_type: "avatar",
      });
    }
    return { photoUrl: cachedPhotoUrl };
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
