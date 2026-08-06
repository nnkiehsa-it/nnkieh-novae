import { ref } from 'vue';
import { cacheUserAvatar } from '@/services/users-write';
import { clearResolvedUploadCache } from '@/services/uploads';
import { clearContentReadCache, clearContentReadMemoryCache, setContentCacheScope } from '@/services/content-read-cache';
import { ensureContentVersionsFresh, resetContentVersionState } from '@/services/content-versions';
import { registerAppResumeHandler } from '@/composables/useAppResume';
import { clearAuthorProfileCache } from '@/composables/useAuthorProfile';
import { readLocalStorage, writeLocalStorage } from '@/lib/browser-storage';
import { stopContentRealtimeSession } from '@/services/realtime-events';

export const mySupportedIssueIds = ref<Set<string>>(new Set());
export const customPhotoUrl = ref<string | null>(null);

let activeSessionToken = 0;
export const VISIT_RECORD_INTERVAL_MS = 24 * 60 * 60 * 1_000;
export const VISIT_RECORDED_AT_KEY = 'novae:platform-visit-recorded-at';
let versionResumeInitialized = false;

export function shouldRecordPlatformVisit() {
  const lastRecordedAt = Number.parseInt(readLocalStorage(VISIT_RECORDED_AT_KEY) || '0', 10);
  return !(Number.isFinite(lastRecordedAt) && Date.now() - lastRecordedAt < VISIT_RECORD_INTERVAL_MS);
}

export function markPlatformVisitRecorded() {
  writeLocalStorage(VISIT_RECORDED_AT_KEY, String(Date.now()));
}

function initializeContentVersionResume() {
  if (versionResumeInitialized) return;
  versionResumeInitialized = true;
  registerAppResumeHandler(() => {
    void ensureContentVersionsFresh({ notify: true }).catch(() => undefined);
  });
  window.addEventListener('online', () => {
    void ensureContentVersionsFresh({ notify: true }).catch(() => undefined);
  });
}

export function clearActiveSessionData() {
  stopContentRealtimeSession();
  activeSessionToken += 1;
  mySupportedIssueIds.value = new Set();
  customPhotoUrl.value = null;
  clearResolvedUploadCache();
  clearContentReadCache();
  resetContentVersionState();
}

export async function initActiveSessionData(uid: string) {
  activeSessionToken += 1;
  mySupportedIssueIds.value = new Set();
  customPhotoUrl.value = null;
  clearResolvedUploadCache();
  clearAuthorProfileCache();
  setContentCacheScope(uid);
  clearContentReadMemoryCache();
  initializeContentVersionResume();
}

export async function cacheUserAvatarOnLogin(photoURL: string) {
  try {
    const photoUrl = await cacheUserAvatar(photoURL);
    if (photoUrl) {
      customPhotoUrl.value = photoUrl;
      clearAuthorProfileCache();
    }
  } catch {
    void 0;
  }
}
