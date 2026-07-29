import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';
import { auth, allowedDomain } from '@/lib/firebase';
import { GoogleIdentityError, requestGoogleAccessToken } from '@/lib/google-identity';
import type { SessionState } from '@/composables/sessionTypes';
import { withRequestTimeout } from '@/lib/request';
import { debugLog } from '@/composables/sessionDebug';
import { readLocalStorage, writeLocalStorage } from '@/lib/browser-storage';

const LOGIN_ATTEMPT_KEY = 'novae-login-attempts';
const LOGIN_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 30;
const LOGIN_CLICK_COOLDOWN_MS = 2_000;
const authEmulatorUrl = String(import.meta.env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? '').trim();
const googleClientId = String(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim();
let lastLoginAttemptAt = 0;

function claimLoginAttempt() {
  const now = Date.now();
  if (now - lastLoginAttemptAt < LOGIN_CLICK_COOLDOWN_MS) return false;
  lastLoginAttemptAt = now;
  try {
    const parsed = JSON.parse(readLocalStorage(LOGIN_ATTEMPT_KEY) ?? '[]') as unknown;
    const attempts = Array.isArray(parsed)
      ? parsed.filter((value): value is number => typeof value === 'number' && value > now - LOGIN_ATTEMPT_WINDOW_MS)
      : [];
    if (attempts.length >= LOGIN_ATTEMPT_LIMIT) return false;
    writeLocalStorage(LOGIN_ATTEMPT_KEY, JSON.stringify([...attempts, now]));
  } catch {
    // Storage may be unavailable; the in-memory click cooldown still applies.
  }
  return true;
}

function googleProvider(selectAccount = false) {
  const provider = new GoogleAuthProvider();
  if (allowedDomain) {
    provider.setCustomParameters({
      hd: allowedDomain,
      ...(selectAccount ? { prompt: 'select_account' } : {}),
    });
  } else if (selectAccount) {
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  return provider;
}

export async function loginWithGoogle(state: SessionState, options: { selectAccount?: boolean } = {}) {
  debugLog('login requested', {
    allowedDomain,
    emulator: Boolean(authEmulatorUrl),
  });
  state.error = '';
  if (!claimLoginAttempt()) {
    state.error = 'auth.theLoginOperationIsTooFrequentPleaseTryAgainLater';
    return;
  }
  state.loading = true;

  if (!auth) {
    state.error = 'auth.serviceUnavailable';
    state.loading = false;
    return;
  }

  const firebaseAuth = auth;

  try {
    if (authEmulatorUrl) {
      debugLog('starting emulator popup login', {
        customParameters: allowedDomain ? { hd: allowedDomain } : {},
      });
      await signInWithPopup(firebaseAuth, googleProvider(Boolean(options.selectAccount)));
      debugLog('emulator popup login resolved', firebaseAuth.currentUser
        ? {
            uid: firebaseAuth.currentUser.uid,
            email: firebaseAuth.currentUser.email ?? '',
          }
        : null);
      // Explicit click loading ends here; loginBusy stays true via roleLoading
      // while bootstrap finishes after onAuthStateChanged accepts the user.
      state.loading = false;
      return;
    }

    if (!googleClientId) {
      debugLog('missing VITE_GOOGLE_CLIENT_ID; failing closed');
      state.error = 'auth.loginWidgetInitFailed';
      state.loading = false;
      return;
    }

    debugLog('starting GIS token login', {
      hd: allowedDomain || undefined,
    });
    const accessToken = await requestGoogleAccessToken({
      clientId: googleClientId,
      hd: allowedDomain || undefined,
    });
    const credential = GoogleAuthProvider.credential(null, accessToken);
    await signInWithCredential(firebaseAuth, credential);
    debugLog('GIS credential login resolved', firebaseAuth.currentUser
      ? {
          uid: firebaseAuth.currentUser.uid,
          email: firebaseAuth.currentUser.email ?? '',
        }
      : null);
    // Explicit click loading ends here; loginBusy stays true via roleLoading
    // while bootstrap finishes after onAuthStateChanged accepts the user.
    state.loading = false;
  } catch (error) {
    debugLog('login failed before completion', error);
    state.error = getLoginErrorMessage(error);
    state.loading = false;
  }
}

function getLoginErrorMessage(error: unknown, fallback = 'auth.loginFailedPleaseTryAgainLater') {
  if (error instanceof GoogleIdentityError) {
    if (error.code === 'popup_closed' || error.code === 'access_denied') {
      return 'auth.theLoginWindowHasBeenClosedPleaseTryAgain';
    }
    if (error.code === 'popup_blocked') {
      return 'auth.popupBlocked';
    }
    if (error.code === 'script_load_failed' || error.code === 'unavailable') {
      return 'auth.loginWidgetInitFailed';
    }
    return fallback;
  }

  if (!(error instanceof FirebaseError)) {
    return fallback;
  }

  if (
    error.code === 'auth/missing-recaptcha-token'
    || error.code === 'auth/invalid-recaptcha-token'
    || error.code === 'auth/invalid-recaptcha-action'
    || error.code === 'auth/recaptcha-not-enabled'
  ) {
    return 'auth.appCheckFailed';
  }

  if (error.code === 'auth/network-request-failed') {
    return 'auth.connectionFailed';
  }

  if (error.code === 'auth/popup-closed-by-user') {
    return 'auth.theLoginWindowHasBeenClosedPleaseTryAgain';
  }

  if (error.code === 'auth/popup-blocked') {
    return 'auth.popupBlocked';
  }

  if (error.code === 'auth/operation-not-supported-in-this-environment') {
    return 'auth.systemBrowserRequired';
  }

  if (error.code === 'auth/unauthorized-domain') {
    return 'access.googleLoginOriginInvalid';
  }

  if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-credential') {
    return 'auth.loginWidgetInitFailed';
  }

  return fallback;
}

export async function logoutFromFirebase(state: SessionState) {
  if (!auth) {
    state.loading = false;
    return;
  }

  const firebaseAuth = auth;

  state.loading = true;
  try {
    await withRequestTimeout(() => signOut(firebaseAuth), { label: 'auth.signOutLabel' });
  } finally {
    state.loading = false;
  }
}
