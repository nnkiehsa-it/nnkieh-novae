import { invokeBackendAction } from '@/services/backend-action';
import { toReadableBackendError } from './issues-core';

export async function cacheUserAvatar(photoURL: string) {
  try {
    const fn = invokeBackendAction<{ photoURL: string }, { photoUrl: string | null }>('cacheUserAvatar');
    const result = await fn({ photoURL });
    return result.data.photoUrl;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
