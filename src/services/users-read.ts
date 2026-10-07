import { invokeBackendAction } from '@/services/backend-action';
import { readRequestTimeoutMs } from '@/lib/request';
import { toReadableBackendError } from './issues-core';
import {
  createContentCacheKey,
  captureContentCacheWriteGuard,
  getCachedContent,
  getCachedContentPersistent,
  runCoalescedContentRequest,
  setCachedContentFromRead,
  isContentCacheWriteGuardCurrent,
} from '@/services/content-read-cache';
import type { UserPublicProfile } from '@/types';

const USER_PROFILE_REQUEST_PREFIX = 'user-profile|';
const USER_PROFILE_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

export function getCachedUserPublicProfiles(uids: string[]) {
  const profiles: Record<string, UserPublicProfile> = {};
  for (const uid of new Set(uids.map((value) => value.trim()).filter(Boolean))) {
    const profile = getCachedContent<UserPublicProfile>(
      createContentCacheKey(['user-profile', uid]),
      USER_PROFILE_CACHE_TTL_MS,
    );
    if (profile) profiles[uid] = profile;
  }
  return profiles;
}

export async function fetchUserPublicProfiles(uids: string[]) {
  const uniqueUids = [...new Set(uids.map((uid) => uid.trim()).filter(Boolean))];
  const guard = captureContentCacheWriteGuard(USER_PROFILE_REQUEST_PREFIX);

  if (uniqueUids.length === 0) {
    return {};
  }

  try {
    const cachedEntries = await Promise.all(uniqueUids.map(async (uid) => [
      uid,
      await getCachedContentPersistent<UserPublicProfile>(
        createContentCacheKey(['user-profile', uid]),
        USER_PROFILE_CACHE_TTL_MS,
      ),
    ] as const));
    const profiles: Record<string, UserPublicProfile> = {};
    if (!isContentCacheWriteGuardCurrent(guard)) return profiles;
    const missingUids: string[] = [];
    for (const [uid, profile] of cachedEntries) {
      if (profile) profiles[uid] = profile;
      else missingUids.push(uid);
    }
    if (missingUids.length === 0) return profiles;

    missingUids.sort();
    for (let offset = 0; offset < missingUids.length; offset += 50) {
      const batch = missingUids.slice(offset, offset + 50);
      const requestKey = `${USER_PROFILE_REQUEST_PREFIX}${batch.join(',')}`;
      const fetched = await runCoalescedContentRequest(requestKey, async () => {
        const fn = invokeBackendAction<{ uids: string[] }, { profiles: Record<string, UserPublicProfile> }>(
          'getUserPublicProfiles', { timeoutMs: readRequestTimeoutMs },
        );
        return (await fn({ uids: batch })).profiles;
      });
      if (!isContentCacheWriteGuardCurrent(guard)) return {};
      for (const uid of batch) {
        const profile = fetched[uid];
        if (!profile) continue;
        profiles[uid] = profile;
        setCachedContentFromRead({ ...guard, key: createContentCacheKey(['user-profile', uid]) }, profile);
      }
    }
    return profiles;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
