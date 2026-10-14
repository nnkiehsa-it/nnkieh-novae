import { callAction } from '@/services/backend-action';
import { readRequestTimeoutMs } from '@/lib/request';
import { queryClient } from '@/lib/query-client';
import { toReadableBackendError } from './backend-errors';
import type { UserPublicProfile } from '@/types';

export const PROFILE_MAX_AGE_MS = 24 * 60 * 60 * 1_000;
const BATCH_SIZE = 50;
const profileKey = (uid: string) => ['profiles', uid] as const;
const pendingBatches = new Map<string, Promise<Record<string, UserPublicProfile>>>();

function uniqueUids(uids: string[]) {
  return [...new Set(uids.map((uid) => uid.trim()).filter(Boolean))];
}

export function getCachedUserPublicProfiles(uids: string[]) {
  const profiles: Record<string, UserPublicProfile> = {};
  for (const uid of uniqueUids(uids)) {
    const state = queryClient.getQueryState<UserPublicProfile>(profileKey(uid));
    if (state?.data && Date.now() - state.dataUpdatedAt < PROFILE_MAX_AGE_MS) profiles[uid] = state.data;
  }
  return profiles;
}

function readBatch(batch: string[]) {
  const key = batch.join(',');
  const existing = pendingBatches.get(key);
  if (existing) return existing;
  const pending = callAction('getUserPublicProfiles', { uids: batch }, { timeoutMs: readRequestTimeoutMs })
    .then(({ profiles }) => {
      for (const [uid, profile] of Object.entries(profiles)) queryClient.setQueryData(profileKey(uid), profile);
      return profiles;
    })
    .finally(() => pendingBatches.delete(key));
  pendingBatches.set(key, pending);
  return pending;
}

/** The profiles asked for: those read in the last day from the cache, the rest fifty to a request. */
export async function fetchUserPublicProfiles(uids: string[]) {
  const wanted = uniqueUids(uids);
  const profiles = getCachedUserPublicProfiles(wanted);
  const missing = wanted.filter((uid) => !profiles[uid]).sort();
  try {
    for (let offset = 0; offset < missing.length; offset += BATCH_SIZE) {
      Object.assign(profiles, await readBatch(missing.slice(offset, offset + BATCH_SIZE)));
    }
    return profiles;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
