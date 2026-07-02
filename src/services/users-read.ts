import { invokeBackendAction } from '@/services/backend-action';
import { READ_REQUEST_TIMEOUT_MS } from '@/lib/request';
import { toReadableBackendError } from './issues-core';

export async function fetchUserAvatarUrls(uids: string[]) {
  const uniqueUids = Array.from(new Set(uids.filter((uid) => uid && uid.trim().length > 0)))
    .map((uid) => uid.trim())
    .slice(0, 50);

  if (uniqueUids.length === 0) {
    return {};
  }

  try {
    const fn = invokeBackendAction<{ uids: string[] }, { avatars: Record<string, string | null> }>(
      'getUserAvatarUrls',
      { timeoutMs: READ_REQUEST_TIMEOUT_MS },
    );
    const result = await fn({ uids: uniqueUids });
    return result.data.avatars;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
