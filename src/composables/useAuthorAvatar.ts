import { computed, ref, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { fetchUserAvatarUrls } from '@/services/users-read';

const AUTHOR_AVATAR_CACHE_KEY = 'srp:author-avatar-cache';
const MAX_LOCAL_AVATAR_ENTRIES = 300;
const authorAvatarCache = ref<Record<string, string | null>>(readLocalAuthorAvatarCache());
const refreshedUids = new Set<string>();
const pendingUids = new Set<string>();
let flushTimer: number | null = null;

function readLocalAuthorAvatarCache() {
  try {
    const raw = localStorage.getItem(AUTHOR_AVATAR_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed)
      .filter((entry): entry is [string, string | null] =>
        typeof entry[0] === 'string' && (typeof entry[1] === 'string' || entry[1] === null)
      )
      .slice(0, MAX_LOCAL_AVATAR_ENTRIES));
  } catch {
    return {};
  }
}

function writeLocalAuthorAvatarCache() {
  try {
    const entries = Object.entries(authorAvatarCache.value).slice(-MAX_LOCAL_AVATAR_ENTRIES);
    localStorage.setItem(AUTHOR_AVATAR_CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Local cache is opportunistic only.
  }
}

function queueAuthorAvatarRefresh(uid: string) {
  if (!uid) return;
  if (refreshedUids.has(uid)) return;
  refreshedUids.add(uid);
  pendingUids.add(uid);
  if (flushTimer !== null) return;

  flushTimer = window.setTimeout(async () => {
    flushTimer = null;
    const uids = Array.from(pendingUids);
    pendingUids.clear();
    if (uids.length === 0) return;

    try {
      const avatars = await fetchUserAvatarUrls(uids);
      authorAvatarCache.value = {
        ...authorAvatarCache.value,
        ...avatars,
      };
      writeLocalAuthorAvatarCache();
    } catch {
      uids.forEach((uid) => {
        refreshedUids.delete(uid);
      });
    }
  }, 0);
}

export function useAuthorAvatarUrl(
  uid: MaybeRefOrGetter<string | null | undefined>,
  fallbackUrl: MaybeRefOrGetter<string | null | undefined> = null,
) {
  watch(
    () => toValue(uid) ?? '',
    (nextUid) => {
      if (nextUid) queueAuthorAvatarRefresh(nextUid);
    },
    { immediate: true },
  );

  return computed(() => {
    const currentUid = toValue(uid) ?? '';
    const fallback = toValue(fallbackUrl) ?? null;
    if (!currentUid) return fallback;
    return authorAvatarCache.value[currentUid] || fallback;
  });
}
