import { ref } from 'vue';
import { recordPlatformVisit } from '@/services/dashboard';
import { cacheUserAvatar } from '@/services/users-write';
import { clearResolvedUploadCache } from '@/services/uploads';

export const mySupportedIssueIds = ref<Set<string>>(new Set());
export const customPhotoUrl = ref<string | null>(null);

let activeSessionToken = 0;
const VISIT_RECORD_INTERVAL_MS = 6 * 60 * 60 * 1_000;
const VISIT_RECORDED_AT_KEY = 'srp:platform-visit-recorded-at';
const AVATAR_CACHE_PREFIX = 'srp:avatar-cached-source:';

export function clearActiveSessionData() {
  activeSessionToken += 1;
  mySupportedIssueIds.value = new Set();
  customPhotoUrl.value = null;
  clearResolvedUploadCache();
}

export async function initActiveSessionData(uid: string) {
  clearActiveSessionData();
  void uid;
}

export async function cacheUserAvatarOnLogin(photoURL: string) {
  const cachedPhotoUrl = localStorage.getItem(`${AVATAR_CACHE_PREFIX}${photoURL}`);
  if (cachedPhotoUrl) {
    customPhotoUrl.value = cachedPhotoUrl;
    return;
  }
  try {
    const photoUrl = await cacheUserAvatar(photoURL);
    if (photoUrl) {
      customPhotoUrl.value = photoUrl;
      localStorage.setItem(`${AVATAR_CACHE_PREFIX}${photoURL}`, photoUrl);
    }
  } catch {
    void 0;
  }
}

export async function recordPlatformVisitOnLogin() {
  const lastRecordedAt = Number.parseInt(localStorage.getItem(VISIT_RECORDED_AT_KEY) || '0', 10);
  if (Number.isFinite(lastRecordedAt) && Date.now() - lastRecordedAt < VISIT_RECORD_INTERVAL_MS) return;
  try {
    await recordPlatformVisit();
    localStorage.setItem(VISIT_RECORDED_AT_KEY, String(Date.now()));
  } catch {
    void 0;
  }
}
