import { computed, shallowRef, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { fetchUserPublicProfiles } from '@/services/users-read';
import type { UserPublicProfile } from '@/types';
import { markContentCachePrefixStale } from '@/services/content-read-cache';

const PROFILE_REFRESH_INTERVAL_MS = 5 * 60_000;
const PROFILE_BATCH_SIZE = 50;

interface CachedProfile {
  fetchedAt: number;
  profile: UserPublicProfile | null;
}

export interface AuthorProfileState {
  loading: boolean;
  profile: UserPublicProfile | null;
  resolved: boolean;
}

const profileCache = shallowRef<Record<string, CachedProfile>>({});
const pendingUids = new Set<string>();
const inFlightUids = new Set<string>();
let flushTimer: number | null = null;

function needsRefresh(uid: string) {
  const cached = profileCache.value[uid];
  return !cached || Date.now() - cached.fetchedAt >= PROFILE_REFRESH_INTERVAL_MS;
}

function queueProfileRefresh(uid: string) {
  if (!uid || !needsRefresh(uid) || inFlightUids.has(uid)) return;
  pendingUids.add(uid);
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushProfileRefreshes();
  }, 0);
}

async function flushProfileRefreshes() {
  while (pendingUids.size > 0) {
    const uids = Array.from(pendingUids).slice(0, PROFILE_BATCH_SIZE);
    uids.forEach((uid) => {
      pendingUids.delete(uid);
      inFlightUids.add(uid);
    });
    try {
      const profiles = await fetchUserPublicProfiles(uids);
      const fetchedAt = Date.now();
      profileCache.value = {
        ...profileCache.value,
        ...Object.fromEntries(uids.map((uid) => [uid, {
          fetchedAt,
          profile: profiles[uid] ?? null,
        }])),
      };
    } catch {
      const fetchedAt = Date.now();
      profileCache.value = {
        ...profileCache.value,
        ...Object.fromEntries(uids.map((uid) => [uid, { fetchedAt, profile: null }])),
      };
    } finally {
      uids.forEach((uid) => inFlightUids.delete(uid));
    }
  }
}

export function useAuthorProfile(uid: MaybeRefOrGetter<string | null | undefined>) {
  watch(
    () => toValue(uid) ?? '',
    (nextUid) => queueProfileRefresh(nextUid),
    { immediate: true },
  );

  return computed<AuthorProfileState>(() => {
    const currentUid = toValue(uid) ?? '';
    if (!currentUid) return { loading: false, profile: null, resolved: true };
    queueProfileRefresh(currentUid);
    const cached = profileCache.value[currentUid];
    return {
      loading: !cached,
      profile: cached?.profile ?? null,
      resolved: Boolean(cached),
    };
  });
}

export function resolveAuthorProfile(uid: string | null | undefined) {
  const normalizedUid = uid?.trim() ?? '';
  if (!normalizedUid) return null;
  queueProfileRefresh(normalizedUid);
  return profileCache.value[normalizedUid]?.profile ?? null;
}

export function clearAuthorProfileCache() {
  profileCache.value = {};
  pendingUids.clear();
  inFlightUids.clear();
  markContentCachePrefixStale('user-profile|');
  try {
    localStorage.removeItem('novae:author-avatar-cache');
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith('novae:avatar-cached-source:')) localStorage.removeItem(key);
    }
  } catch {
    // Browser storage cleanup is best-effort.
  }
}
