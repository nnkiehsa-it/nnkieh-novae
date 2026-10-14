import { callAction } from '@/services/backend-action';
import { toReadableBackendError } from './backend-errors';

/** Stores a copy of the signed-in account's own avatar; the Worker reads which one from the sign-in. */
export async function cacheUserAvatar() {
  try {
    return (await callAction('cacheUserAvatar', {})).photoUrl;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
