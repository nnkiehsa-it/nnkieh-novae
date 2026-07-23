import { invokeBackendAction } from '@/services/backend-action';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { toReadableBackendError } from './issues-core';
import {
  createContentCacheKey,
  getCachedContentPersistent,
  runCoalescedContentRequest,
  setCachedContent,
} from '@/services/content-read-cache';
import type { UserPublicProfile } from '@/types';

const USER_PROFILE_REQUEST_PREFIX = 'user-profile|';
const USER_PROFILE_CACHE_TTL_MS = 24 * 60 * 60 * 1_000;

export async function fetchUserPublicProfiles(uids: string[]) {
  const uniqueUids = Array.from(new Set(uids.filter((uid) => uid && uid.trim().length > 0)))
    .map((uid) => uid.trim())
    .slice(0, 50);

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
    const missingUids: string[] = [];
    for (const [uid, profile] of cachedEntries) {
      if (profile) profiles[uid] = profile;
      else missingUids.push(uid);
    }
    if (missingUids.length === 0) return profiles;

    const requestKey = `${USER_PROFILE_REQUEST_PREFIX}${[...missingUids].sort().join(',')}`;
    const fetched = await runCoalescedContentRequest(requestKey, async () => {
      const fn = invokeBackendAction<{ uids: string[] }, { profiles: Record<string, UserPublicProfile> }>(
        'getUserPublicProfiles',
        { timeoutMs: READ_REQUEST_TIMEOUT_MS },
      );
      return (await fn({ uids: missingUids })).profiles;
    });
    for (const uid of missingUids) {
      const profile = fetched[uid];
      if (!profile) continue;
      profiles[uid] = profile;
      setCachedContent(createContentCacheKey(['user-profile', uid]), profile);
    }
    return profiles;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
