import type { User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

const EXPIRY_SKEW_MS = 60_000;

let cachedUid = '';
let cachedToken = '';
let cachedExpiresAt = 0;
let pendingToken: Promise<string | null> | null = null;

function tokenExpiry(token: string) {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const base64 = payload.replace(/-/gu, '+').replace(/_/gu, '/');
    const normalized = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const decoded = JSON.parse(atob(normalized)) as { exp?: unknown };
    return typeof decoded.exp === 'number' ? decoded.exp * 1_000 : 0;
  } catch {
    return 0;
  }
}

async function loadToken(user: User) {
  const token = await user.getIdToken();
  if (auth?.currentUser?.uid !== user.uid) return null;
  cachedUid = user.uid;
  cachedToken = token;
  cachedExpiresAt = tokenExpiry(token);
  return token;
}

function clearFirebaseIdTokenCache() {
  cachedUid = '';
  cachedToken = '';
  cachedExpiresAt = 0;
  pendingToken = null;
}

export async function getFirebaseIdToken() {
  const user = auth?.currentUser;
  if (!user) {
    clearFirebaseIdTokenCache();
    return null;
  }
  if (
    cachedUid === user.uid
    && cachedToken
    && cachedExpiresAt - EXPIRY_SKEW_MS > Date.now()
  ) {
    return cachedToken;
  }
  pendingToken ??= loadToken(user).finally(() => {
    pendingToken = null;
  });
  return pendingToken;
}
