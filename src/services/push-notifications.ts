import type { ActionRequest } from '@shared/actions.ts';
import type { AdminNotificationPreferences, BrowserPermission } from '@shared/contracts/notifications.ts';
import { callAction } from '@/services/backend-action';
import { invalidate, readQuery } from '@/lib/query-client';
import { toReadableBackendError } from './backend-errors';

export type { PushPreference as PushNotificationPreference } from '@shared/contracts/notifications.ts';
export type PlatformAdminNotificationPreferences = AdminNotificationPreferences;

const PREFERENCE_MAX_AGE_MS = 10 * 60 * 1_000;

/** What this browser allows; `unsupported` is a browser with no notifications at all. */
export type PushNotificationPermission = BrowserPermission | 'unsupported';

export async function getPushNotificationPreference(deviceId: string, permission: PushNotificationPermission) {
  // A browser that cannot show notifications has never been asked, as far as the server is concerned.
  const asked = permission === 'unsupported' ? 'default' : permission;
  return readQuery(['push', deviceId, asked], async () => {
    try {
      return await callAction('getPushNotificationPreference', { deviceId, permission: asked });
    } catch (error) {
      throw toReadableBackendError(error);
    }
  }, PREFERENCE_MAX_AGE_MS);
}

export async function registerPushToken(payload: ActionRequest<'registerPushToken'>) {
  try {
    const result = await callAction('registerPushToken', payload);
    void invalidate(['push']);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function unregisterPushToken(deviceId: string) {
  await callAction('unregisterPushToken', { deviceId }, { timeoutMs: 5_000 });
  void invalidate(['push']);
}

export async function getPlatformAdminNotificationPreferences() {
  try {
    return await callAction('getPlatformAdminNotificationPreferences', {});
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function updatePlatformAdminNotificationPreferences(preferences: PlatformAdminNotificationPreferences) {
  try {
    return await callAction('updatePlatformAdminNotificationPreferences', { preferences });
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
