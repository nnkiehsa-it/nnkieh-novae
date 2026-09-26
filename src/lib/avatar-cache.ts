import { readLocalStorage, writeLocalStorage } from "@/lib/browser-storage";
import { getOperationPolicy } from "@/lib/operation-policies";

const AVATAR_CACHE_KEY = "novae:avatar";

interface CachedAvatar {
  cachedAt: number;
  photoUrl: string;
  sourceUrl: string;
  uid: string;
}

/**
 * The avatar this browser was last given, kept so that opening Novae again is
 * not a request.
 *
 * Every session start asked the worker to cache the signed-in account's avatar,
 * which is a write and is rate limited as one: a handful of reloads in a day
 * spent the whole allowance and the rest were refused outright.
 */
export function readCachedAvatar(uid: string, sourceUrl: string): string | null {
  const stored = readLocalStorage(AVATAR_CACHE_KEY);
  if (!stored) return null;
  let cached: CachedAvatar;
  try {
    cached = JSON.parse(stored) as CachedAvatar;
  } catch {
    return null;
  }
  if (cached.uid !== uid || cached.sourceUrl !== sourceUrl) return null;
  if (!(Date.now() - cached.cachedAt < getOperationPolicy("avatarRevalidateHours") * 60 * 60 * 1_000)) return null;
  return cached.photoUrl || null;
}

export function writeCachedAvatar(uid: string, sourceUrl: string, photoUrl: string) {
  const cached: CachedAvatar = { cachedAt: Date.now(), photoUrl, sourceUrl, uid };
  writeLocalStorage(AVATAR_CACHE_KEY, JSON.stringify(cached));
}
