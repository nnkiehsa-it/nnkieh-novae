const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GSI_SCOPE = 'openid email profile';
const GSI_LOAD_TIMEOUT_MS = 10_000;
const TOKEN_REQUEST_TIMEOUT_MS = 30_000;

export type GoogleIdentityErrorCode =
  | 'script_load_failed'
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

let gsiLoadPromise: Promise<void> | null = null;

function loadGsiClient(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new GoogleIdentityError('unavailable'));
  }
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gsiLoadPromise) return gsiLoadPromise;

  gsiLoadPromise = new Promise<void>((resolve, reject) => {
    let script: HTMLScriptElement | null = null;
    let timeoutId = 0;
    const fail = () => {
      window.clearTimeout(timeoutId);
      script?.remove();
      gsiLoadPromise = null;
      reject(new GoogleIdentityError('script_load_failed'));
    };
    const succeed = () => {
      window.clearTimeout(timeoutId);
      resolve();
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        succeed();
        return;
      }
      // A previous failed/half-loaded GIS script will never emit load/error again.
      // Remove it so this attempt can make a fresh request instead of hanging forever.
      existing.remove();
    }

    script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) succeed();
      else fail();
    };
    script.onerror = fail;
    timeoutId = window.setTimeout(fail, GSI_LOAD_TIMEOUT_MS);
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
}

export function preloadGoogleIdentity(): Promise<void> {
  return loadGsiClient().catch(() => undefined);
}

function mapTokenResponseError(error?: string): GoogleIdentityErrorCode {
  if (error === 'access_denied' || error === 'immediate_failed') return 'access_denied';
  if (error === 'popup_closed') return 'popup_closed';
  return 'unknown';
}

function mapClientError(type?: string): GoogleIdentityErrorCode {
  if (type === 'popup_failed_to_open') return 'popup_blocked';
  if (type === 'popup_closed') return 'popup_closed';
  return 'unknown';
}

function triggerTokenRequest(
  oauth2: GoogleOAuth2,
  clientId: string,
  hd?: string,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    let timeoutId = 0;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      callback();
    };
    timeoutId = window.setTimeout(() => {
      finish(() => reject(new GoogleIdentityError('timeout')));
    }, TOKEN_REQUEST_TIMEOUT_MS);
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GSI_SCOPE,
      prompt: 'select_account',
      ...(hd ? { hd } : {}),
      callback: (response) => {
        if (response.error || !response.access_token) {
          finish(() => reject(new GoogleIdentityError(mapTokenResponseError(response.error))));
          return;
        }
        finish(() => resolve(response.access_token));
      },
      error_callback: (error) => {
        finish(() => reject(new GoogleIdentityError(mapClientError(error?.type))));
      },
    });
    try {
      client.requestAccessToken();
    } catch {
      finish(() => reject(new GoogleIdentityError('unavailable')));
    }
  });
}

export async function requestGoogleAccessToken(options: {
  clientId: string;
  hd?: string;
}): Promise<string> {
  const clientId = options.clientId.trim();
  if (!clientId) {
    throw new GoogleIdentityError('unavailable');
  }

  if (typeof window !== 'undefined' && window.google?.accounts?.oauth2) {
    return triggerTokenRequest(window.google.accounts.oauth2, clientId, options.hd);
  }

  await loadGsiClient();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new GoogleIdentityError('unavailable');
  }

  return triggerTokenRequest(oauth2, clientId, options.hd);
}

