import {
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signOut,
} from 'firebase/auth';
import { computed, reactive } from 'vue';
import { auth, allowedDomain } from '@/lib/firebase';
import type { SessionState } from '@/composables/sessionTypes';
import { debugLog } from '@/composables/sessionDebug';
import { loginWithGoogle, logoutFromFirebase } from '@/composables/sessionAuthActions';
import {
  cacheUserAvatarOnLogin,
  clearActiveSessionData,
  customPhotoUrl,
  initActiveSessionData,
  mySupportedIssueIds,
  recordPlatformVisitOnLogin,
} from '@/composables/sessionEffects';
import { validateBasicUser, validateUserAgainstToken } from '@/composables/sessionValidation';
import { withRequestTimeout } from '@/lib/request';
import { ensureSupabaseAuthenticatedRole } from '@/services/supabase-auth';
import { fetchCurrentUserRole } from '@/services/session-role';

const state = reactive<SessionState>({
  initialized: false,
  loading: true,
  authChecking: true,
  userLoading: false,
  appInitializing: true,
  appReady: false,
  user: null,
  userRole: 'user',
  error: '',
});

let booted = false;
const sessionReadyWaiters: Array<() => void> = [];

function resolveSessionReadyWaiters() {
  if (!state.appReady) return;
  while (sessionReadyWaiters.length > 0) {
    sessionReadyWaiters.shift()?.();
  }
}

function markAppReady() {
  state.loading = false;
  state.authChecking = false;
  state.userLoading = false;
  state.appInitializing = false;
  state.initialized = true;
  state.appReady = true;
  resolveSessionReadyWaiters();
}

function observeAuthState(firebaseAuth: NonNullable<typeof auth>) {
  void withRequestTimeout(() => getRedirectResult(firebaseAuth), { label: '登入回復' })
    .then((result) => {
      debugLog('getRedirectResult resolved', result
        ? {
            uid: result.user.uid,
            email: result.user.email ?? '',
            providerId: result.providerId ?? '',
          }
        : null);
    })
    .catch((error) => {
      debugLog('getRedirectResult failed', error);
      state.error = '登入失敗，請稍後再試。';
    });

  onAuthStateChanged(firebaseAuth, async (user) => {
    debugLog('onAuthStateChanged fired', user
      ? {
          uid: user.uid,
          email: user.email ?? '',
          emailVerified: user.emailVerified,
          providers: user.providerData.map((provider) => provider.providerId),
        }
      : null);
    state.loading = true;
    state.authChecking = false;
    state.userLoading = Boolean(user);
    state.appInitializing = true;
    state.appReady = false;
    state.error = '';

    try {
      if (!user) {
        debugLog('no active user after auth state change');
        clearActiveSessionData();
        state.user = null;
        return;
      }

      const basicValidation = validateBasicUser(user);
      if (!basicValidation.ok) {
        debugLog('basic validation failed', basicValidation);
        await rejectCurrentUser(basicValidation.reason);
        return;
      }

      const tokenValidation = await validateUserAgainstToken(user);
      if (!tokenValidation.ok) {
        debugLog('token validation failed', tokenValidation);
        await rejectCurrentUser(tokenValidation.reason);
        return;
      }

      try {
        await ensureSupabaseAuthenticatedRole(user);
      } catch (error) {
        debugLog('supabase auth initialization failed', error);
        await rejectCurrentUser('登入初始化失敗，請重新登入後再試。');
        return;
      }

      await acceptCurrentUser(user);
    } catch (error) {
      debugLog('auth state processing failed', error);
      state.error = '登入狀態檢查逾時，請重新載入。';
    } finally {
      markAppReady();
    }
  });
}

async function rejectCurrentUser(reason: string) {
  if (!auth) return;
  const firebaseAuth = auth;

  clearActiveSessionData();
  state.user = null;
  state.userRole = 'user';
  state.error = reason;
  try {
    await withRequestTimeout(() => signOut(firebaseAuth), { label: '登出' });
  } finally {
    markAppReady();
  }
}

async function acceptCurrentUser(user: NonNullable<SessionState['user']>) {
  debugLog('login accepted', {
    uid: user.uid,
    email: user.email ?? '',
  });

  void initActiveSessionData(user.uid);
  state.userRole = await fetchCurrentUserRole();
  state.user = user;

  if (user.photoURL) {
    void cacheUserAvatarOnLogin(user.photoURL);
  }
  void recordPlatformVisitOnLogin();
}

export function initializeSession() {
  if (booted) {
    return;
  }

  booted = true;
  if (!auth) {
    state.user = null;
    state.error = '服務暫時無法使用，請稍後再試。';
    markAppReady();
    return;
  }

  const firebaseAuth = auth;
  void withRequestTimeout(
    () => setPersistence(firebaseAuth, browserLocalPersistence),
    { label: '登入狀態初始化' },
  )
    .catch((error) => {
      debugLog('local auth persistence unavailable', error);
    })
    .finally(() => observeAuthState(firebaseAuth));
}

export function waitForSessionReady() {
  initializeSession();
  if (state.appReady) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    sessionReadyWaiters.push(resolve);
  });
}

export function useSession() {
  const userEmail = computed(() => String(state.user?.email ?? '').toLowerCase());
  const userRole = computed(() => state.userRole);

  return {
    user: computed(() => state.user),
    userEmail,
    userRole,
    isAdmin: computed(() => userRole.value === 'admin'),
    loading: computed(() => state.loading),
    authChecking: computed(() => state.authChecking),
    userLoading: computed(() => state.userLoading),
    appInitializing: computed(() => state.appInitializing),
    appReady: computed(() => state.appReady),
    initialized: computed(() => state.initialized),
    error: computed(() => state.error),
    isAllowedUser: computed(() => Boolean(state.user)),
    mySupportedIssueIds,
    customPhotoUrl,
    allowedDomain,
    login: (options?: { selectAccount?: boolean }) => loginWithGoogle(state, options),
    logout: () => logoutFromFirebase(state),
  };
}
