import {
  createCloudinaryAuthenticatedImageUrl,
  sha256Hex,
  uploadCloudinaryAuthenticatedImage,
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
    const sourceUrl = auth.photoUrl;
    if (!sourceUrl) return { photoUrl: null };
    const parsedSourceUrl = new URL(sourceUrl);
    if (
      parsedSourceUrl.protocol !== "https:"
      || !parsedSourceUrl.hostname.toLowerCase().endsWith(".googleusercontent.com")
    ) throw new Error("avatar-source-not-allowed");

    const { data: existing, error: existingError } = await supabase
      .schema("app_private")
      .from("user_profiles")
      .select("avatar_hash,avatar_public_id,avatar_source_url,avatar_version,cached_photo_url")
      .eq("uid", auth.uid)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing?.avatar_source_url === sourceUrl && existing.cached_photo_url) {
      return { photoUrl: existing.cached_photo_url };
    }

    await claimFixedWindowRateLimit(auth.uid, "avatar.cache", taipeiDayWindow(), RATE_LIMITS.avatarCacheDaily);

    const imageResponse = await fetch(sourceUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    if (!imageResponse.ok) {
      throw new Error(`avatar-fetch-failed:${imageResponse.status}`);
    }
    const contentType = imageResponse.headers.get("content-type") ?? "";
    const contentLength = Number(imageResponse.headers.get("content-length") ?? 0);
    if (!contentType.startsWith("image/") || contentLength > 5 * 1024 * 1024) {
      throw new Error("avatar-source-invalid");
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    if (imageBuffer.byteLength > 5 * 1024 * 1024) throw new Error("avatar-source-invalid");
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
    await uploadCloudinaryAuthenticatedImage(
      nextPublicId,
      new Blob([imageBuffer], { type: contentType }),
    );
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
      const { error: deletionError } = await supabase.schema("app_private").from("deletion_jobs").insert({
        cloudinary_public_id: previousPublicId,
        target_id: auth.uid,
        target_type: "avatar",
      });
      if (deletionError) throw deletionError;
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
