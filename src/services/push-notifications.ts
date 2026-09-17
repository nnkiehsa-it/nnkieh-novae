import { invokeBackendAction } from '@/services/backend-action';
import {
  CONTENT_SHORT_CACHE_TTL_MS,
  captureContentCacheWriteGuard,
  createContentCacheKey,
  getCachedContentPersistent,
  markContentCachePrefixStale,
  setCachedContentFromRead,
} from '@/services/content-read-cache';
import { toReadableBackendError } from './issues-core';

const PUSH_PREFERENCE_CACHE_PREFIX = 'push-notification-preference|';

export type PushNotificationPermission = NotificationPermission | 'unsupported';
export type PlatformAdminNotificationPreferenceKey =
  | 'commentNotifications'
  | 'facilityNotifications'
  | 'issueNotifications';

export type PlatformAdminNotificationPreferences = Record<
  PlatformAdminNotificationPreferenceKey,
  boolean
>;

export interface PushNotificationPreference {
  deviceEnabled: boolean;
  enabled: boolean;
  permission: PushNotificationPermission;
  tokenCount: number;
}

interface GetPushNotificationPreferencePayload {
  deviceId?: string;
  permission?: PushNotificationPermission;
  token?: string;
}

interface RegisterPushTokenPayload {
  deviceId: string;
  permission: NotificationPermission;
  platform: string;
  token: string;
  userAgent: string;
}

export async function getPushNotificationPreference(payload: GetPushNotificationPreferencePayload = {}) {
  const cacheKey = createContentCacheKey([
    'push-notification-preference',
    payload.deviceId ?? '',
    payload.permission ?? '',
    payload.token ?? '',
  ]);
  const cached = await getCachedContentPersistent<PushNotificationPreference>(
    cacheKey,
    CONTENT_SHORT_CACHE_TTL_MS,
  );
  if (cached) return cached;
  const cacheGuard = captureContentCacheWriteGuard(cacheKey);
  try {
    const fn = invokeBackendAction<GetPushNotificationPreferencePayload, PushNotificationPreference>('getPushNotificationPreference');
    const result = await fn(payload);
    setCachedContentFromRead(cacheGuard, result);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function registerPushToken(payload: RegisterPushTokenPayload) {
  try {
    const fn = invokeBackendAction<RegisterPushTokenPayload, PushNotificationPreference>('registerPushToken');
    const result = await fn(payload);
    markContentCachePrefixStale(PUSH_PREFERENCE_CACHE_PREFIX);
    return result;
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function getPlatformAdminNotificationPreferences() {
  try {
    const fn = invokeBackendAction<Record<string, never>, PlatformAdminNotificationPreferences>(
      'getPlatformAdminNotificationPreferences',
    );
    return await fn({});
  } catch (error) {
    throw toReadableBackendError(error);
  }
}

export async function updatePlatformAdminNotificationPreferences(
  preferences: PlatformAdminNotificationPreferences,
) {
  try {
    const fn = invokeBackendAction<
      { preferences: PlatformAdminNotificationPreferences },
      PlatformAdminNotificationPreferences
    >('updatePlatformAdminNotificationPreferences');
    return await fn({ preferences });
  } catch (error) {
    throw toReadableBackendError(error);
  }
}
