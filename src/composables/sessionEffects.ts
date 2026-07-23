import { ref } from 'vue';
import { cacheUserAvatar } from '@/services/users-write';
import { clearResolvedUploadCache } from '@/services/uploads';
import { clearContentReadCache, clearContentReadMemoryCache, setContentCacheScope } from '@/services/content-read-cache';
import { ensureContentRevisionsFresh, resetContentRevisionState } from '@/services/content-revisions';
import { registerAppResumeHandler } from '@/composables/useAppResume';
import { clearAuthorProfileCache } from '@/composables/useAuthorProfile';

export const mySupportedIssueIds = ref<Set<string>>(new Set());
export const customPhotoUrl = ref<string | null>(null);

let activeSessionToken = 0;
export const VISIT_RECORD_INTERVAL_MS = 24 * 60 * 60 * 1_000;
export const VISIT_RECORDED_AT_KEY = 'novae:platform-visit-recorded-at';
const CONTENT_REVISION_RESUME_MS = 10 * 60_000;
let revisionResumeInitialized = false;

export function shouldRecordPlatformVisit() {
  const lastRecordedAt = Number.parseInt(localStorage.getItem(VISIT_RECORDED_AT_KEY) || '0', 10);
  return !(Number.isFinite(lastRecordedAt) && Date.now() - lastRecordedAt < VISIT_RECORD_INTERVAL_MS);
}

export function markPlatformVisitRecorded() {
  try {
    localStorage.setItem(VISIT_RECORDED_AT_KEY, String(Date.now()));
  } catch {
    // Storage failures must not block sign-in.
  }
}

function initializeContentRevisionResume() {
  if (revisionResumeInitialized) return;
  revisionResumeInitialized = true;
  registerAppResumeHandler((reason, hiddenDurationMs) => {
    if (reason !== 'pageshow' && hiddenDurationMs < CONTENT_REVISION_RESUME_MS) return;
    void ensureContentRevisionsFresh({ notify: true }).catch(() => undefined);
  });
}

export function clearActiveSessionData() {
  activeSessionToken += 1;
  mySupportedIssueIds.value = new Set();
  customPhotoUrl.value = null;
  clearResolvedUploadCache();
  clearContentReadCache();
  resetContentRevisionState();
}

export async function initActiveSessionData(uid: string) {
  activeSessionToken += 1;
  mySupportedIssueIds.value = new Set();
  customPhotoUrl.value = null;
  clearResolvedUploadCache();
  clearAuthorProfileCache();
  setContentCacheScope(uid);
  clearContentReadMemoryCache();
  initializeContentRevisionResume();
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
