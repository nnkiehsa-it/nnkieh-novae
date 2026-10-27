import { readSessionStorage, removeSessionStorage, writeSessionStorage } from '@/lib/browser-storage';

/**
 * Google sign-in over the plain OAuth `id_token` response: a popup first, a
 * full-page redirect when the browser will not open one. Both land on the same
 * callback route and end as an ID token for Firebase's `signInWithCredential`.
 */
export const GOOGLE_CALLBACK_PATH = '/auth/google/callback';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const SCOPE = 'openid email profile';
const CHANNEL_NAME = 'novae-google-auth';
const PENDING_KEY = 'novae-google-redirect-pending';
const RESULT_KEY = 'novae-google-redirect-result';
const POPUP_NAME = 'novae-google-login';
const POPUP_TIMEOUT_MS = 3 * 60_000;
const POPUP_POLL_MS = 500;
const POPUP_CLOSE_GRACE_MS = 1_000;
const REDIRECT_MAX_AGE_MS = 10 * 60_000;

type GoogleIdentityErrorCode =
  | 'popup_blocked'
  | 'popup_closed'
  | 'access_denied'
  | 'unavailable'
  | 'timeout'
  | 'unknown';

export class GoogleIdentityError extends Error {
  readonly code: GoogleIdentityErrorCode;

  constructor(code: GoogleIdentityErrorCode, message = code) {
    super(message);
    this.name = 'GoogleIdentityError';
    this.code = code;
  }
}

type Mode = 'popup' | 'redirect';

interface CallbackPayload {
  state: string;
  idToken: string;
  error: string;
}

interface RedirectPending {
  state: string;
  nonce: string;
  returnTo: string;
  createdAt: number;
}

interface LoginOptions {
  clientId: string;
  hd?: string;
}

function randomToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function callbackUri() {
  return `${window.location.origin}${GOOGLE_CALLBACK_PATH}`;
}

function authUrl(options: LoginOptions, state: string, nonce: string) {
  const params = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: callbackUri(),
    response_type: 'id_token',
    scope: SCOPE,
    state,
    nonce,
    prompt: 'select_account',
  });
  if (options.hd) params.set('hd', options.hd);
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

function decodeSegment(segment: string): Record<string, unknown> | null {
  try {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const parsed = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='))) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * The signature is Firebase's to verify; this only proves the token was minted
 * for this attempt (nonce) and this client (aud), so a token injected into the
 * callback URL cannot be signed in with.
 */
export function idTokenMatchesRequest(idToken: string, expected: { nonce: string; clientId: string }) {
  const claims = decodeSegment(idToken.split('.')[1] ?? '');
  return Boolean(claims) && claims?.nonce === expected.nonce && claims?.aud === expected.clientId;
}

export function parseGoogleCallback(url: { hash: string; search: string }): CallbackPayload {
  const params = new URLSearchParams(url.hash.replace(/^#/, ''));
  for (const [key, value] of new URLSearchParams(url.search)) {
    if (!params.has(key)) params.set(key, value);
  }
  return {
    state: params.get('state') ?? '',
    idToken: params.get('id_token') ?? '',
    error: params.get('error') ?? '',
  };
}

function modeOf(state: string): Mode | null {
  if (state.startsWith('popup.')) return 'popup';
  if (state.startsWith('redirect.')) return 'redirect';
  return null;
}

function failureOf(error: string) {
  return new GoogleIdentityError(error === 'access_denied' ? 'access_denied' : 'unknown');
}

function safeReturnTo(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

function readPending(): RedirectPending | null {
  const raw = readSessionStorage(PENDING_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<RedirectPending>;
    if (
      typeof value.state === 'string'
      && typeof value.nonce === 'string'
      && typeof value.createdAt === 'number'
      && Date.now() - value.createdAt < REDIRECT_MAX_AGE_MS
    ) {
      return { state: value.state, nonce: value.nonce, createdAt: value.createdAt, returnTo: safeReturnTo(value.returnTo) };
    }
  } catch {
    // An unreadable record is as good as none.
  }
  return null;
}

/**
 * Runs before the app renders on the callback route. Returns true when the
 * page was the callback and has been dealt with, so nothing else should mount.
 */
export function handleGoogleCallbackPage(): boolean {
  if (window.location.pathname !== GOOGLE_CALLBACK_PATH) return false;
  const payload = parseGoogleCallback(window.location);
  const mode = modeOf(payload.state);

  if (mode === 'popup') {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.postMessage(payload);
    channel.close();
    window.close();
    // A window that was not opened by script refuses to close; leave the callback URL.
    window.location.replace('/');
    return true;
  }

  const pending = readPending();
  if (mode === 'redirect' && pending && pending.state === payload.state) {
    writeSessionStorage(RESULT_KEY, JSON.stringify(payload));
    window.location.replace(pending.returnTo);
    return true;
  }
  removeSessionStorage(PENDING_KEY);
  window.location.replace('/');
  return true;
}

/** Sends the whole page to Google; the result is picked up by `takeGoogleRedirectResult`. */
export function startGoogleRedirect(options: LoginOptions): void {
  const clientId = options.clientId.trim();
  if (!clientId) throw new GoogleIdentityError('unavailable');
  const state = `redirect.${randomToken()}`;
  const nonce = randomToken();
  const pending: RedirectPending = {
    state,
    nonce,
    returnTo: safeReturnTo(`${window.location.pathname}${window.location.search}`),
    createdAt: Date.now(),
  };
  writeSessionStorage(PENDING_KEY, JSON.stringify(pending));
  window.location.assign(authUrl({ ...options, clientId }, state, nonce));
}

/**
 * The ID token of a redirect sign-in that has just come back, `null` when
 * there is none, or a thrown `GoogleIdentityError` when Google refused it.
 */
export function takeGoogleRedirectResult(clientId: string): string | null {
  const rawResult = readSessionStorage(RESULT_KEY);
  if (!rawResult) return null;
  removeSessionStorage(RESULT_KEY);
  const pending = readPending();
  removeSessionStorage(PENDING_KEY);
  if (!pending) return null;
  let payload: Partial<CallbackPayload>;
  try {
    payload = JSON.parse(rawResult) as Partial<CallbackPayload>;
  } catch {
    throw new GoogleIdentityError('unknown');
  }
  if (payload.state !== pending.state) throw new GoogleIdentityError('unknown');
  if (payload.error) throw failureOf(payload.error);
  if (!payload.idToken || !idTokenMatchesRequest(payload.idToken, { nonce: pending.nonce, clientId })) {
    throw new GoogleIdentityError('unknown');
  }
  return payload.idToken;
}

function popupFeatures() {
  const width = 500;
  const height = 640;
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
  return `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
}

/**
 * Must be called straight from the user's click or the browser blocks the
 * popup; a block rejects with `popup_blocked` so the caller can redirect.
 */
export function requestGoogleIdToken(options: LoginOptions): Promise<string> {
  const clientId = options.clientId.trim();
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined' || !clientId) {
    return Promise.reject(new GoogleIdentityError('unavailable'));
  }
  const state = `popup.${randomToken()}`;
  const nonce = randomToken();
  const popup = window.open(authUrl({ ...options, clientId }, state, nonce), POPUP_NAME, popupFeatures());
  if (!popup) return Promise.reject(new GoogleIdentityError('popup_blocked'));

  return new Promise<string>((resolve, reject) => {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    let settled = false;
    let closedSince = 0;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      channel.close();
      callback();
    };
    channel.onmessage = (event: MessageEvent<CallbackPayload>) => {
      const payload = event.data;
      if (payload?.state !== state) return;
      finish(() => {
        if (payload.error) reject(failureOf(payload.error));
        else if (payload.idToken && idTokenMatchesRequest(payload.idToken, { nonce, clientId })) resolve(payload.idToken);
        else reject(new GoogleIdentityError('unknown'));
      });
    };
    const timeoutId = window.setTimeout(() => {
      finish(() => {
        popup.close();
        reject(new GoogleIdentityError('timeout'));
      });
    }, POPUP_TIMEOUT_MS);
    // The callback may still be posting its message as the window goes away.
    const pollId = window.setInterval(() => {
      if (!popup.closed) return;
      closedSince ||= Date.now();
      if (Date.now() - closedSince >= POPUP_CLOSE_GRACE_MS) {
        finish(() => reject(new GoogleIdentityError('popup_closed')));
      }
    }, POPUP_POLL_MS);
  });
}
