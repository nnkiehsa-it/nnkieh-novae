import type { ActionRequest } from '@shared/actions.ts';
import type { AdminNotificationPreferences, BrowserPermission } from '@shared/contracts/notifications.ts';
import { callAction } from '@/services/backend-action';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  captureContentCacheWriteGuard,
  createContentCacheKey,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  setCachedContentFromRead,
} from '@/services/content-read-cache';
import { toReadableBackendError } from './backend-errors';

export type { PushPreference as PushNotificationPreference } from '@shared/contracts/notifications.ts';
export type PlatformAdminNotificationPreferences = AdminNotificationPreferences;

const PUSH_PREFERENCE_CACHE_PREFIX = 'push-notification-preference|';

/** What this browser allows; `unsupported` is a browser with no notifications at all. */
export type PushNotificationPermission = BrowserPermission | 'unsupported';

export async function getPushNotificationPreference(deviceId: string, permission: PushNotificationPermission) {
  // A browser that cannot show notifications has never been asked, as far as the server is concerned.
  const asked = permission === 'unsupported' ? 'default' : permission;
  const cacheKey = createContentCacheKey(['push-notification-preference', deviceId, asked]);
  const cached = await getCachedContentPersistent<Awaited<ReturnType<typeof readPreference>>>(
    cacheKey,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  if (cached) return cached;
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  try {
    const result = await readPreference(deviceId, asked);
    setCachedContentFromRead(cacheGuard, result);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

function readPreference(deviceId: string, permission: BrowserPermission) {
  return callAction('getPushNotificationPreference', { deviceId, permission });
}

export async function registerPushToken(payload: ActionRequest<'registerPushToken'>) {
  try {
    const result = await callAction('registerPushToken', payload);
    markContentCachePrefixStale(PUSH_PREFERENCE_CACHE_PREFIX);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function unregisterPushToken(deviceId: string) {
  await callAction('unregisterPushToken', { deviceId }, { timeoutMs: 5_000 });
  markContentCachePrefixStale(PUSH_PREFERENCE_CACHE_PREFIX);
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
