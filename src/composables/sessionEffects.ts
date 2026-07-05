import { ref } from 'vue';
import { recordPlatformVisit } from '@/services/dashboard';
import { cacheUserAvatar } from '@/services/users-write';
import { clearResolvedUploadCache } from '@/services/uploads';

export const mySupportedIssueIds = ref<Set<string>>(new Set());
export const customPhotoUrl = ref<string | null>(null);

let activeSessionToken = 0;

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
  try {
    const photoUrl = await cacheUserAvatar(photoURL);
    if (photoUrl) {
      customPhotoUrl.value = photoUrl;
    }
  } catch {
    void 0;
  }
}

export async function recordPlatformVisitOnLogin() {
  try {
    await recordPlatformVisit();
  } catch {
    void 0;
  }
}
