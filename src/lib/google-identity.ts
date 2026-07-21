const GSI_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';
const GSI_SCOPE = 'openid email profile';

export type GoogleIdentityErrorCode =
  | 'script_load_failed'
  | 'popup_blocked'
  | 'popup_closed'
  | 'access_denied'
  | 'unavailable'
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
    const fail = () => {
      gsiLoadPromise = null;
      reject(new GoogleIdentityError('script_load_failed'));
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SCRIPT_SRC}"]`);
    if (existing) {
      if (window.google?.accounts?.oauth2) {
        resolve();
        return;
      }
      existing.addEventListener('load', () => {
        if (window.google?.accounts?.oauth2) resolve();
        else fail();
      }, { once: true });
      existing.addEventListener('error', fail, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      if (window.google?.accounts?.oauth2) resolve();
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });

  return gsiLoadPromise;
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

/** iOS Safari often blocks the first GIS popup; retry once for transient open failures. */
function shouldRetryGoogleAccessToken(error: unknown) {
  if (!(error instanceof GoogleIdentityError)) return false;
  return error.code === 'popup_blocked'
    || error.code === 'popup_closed'
    || error.code === 'unknown';
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function requestGoogleAccessTokenOnce(options: {
  clientId: string;
  hd?: string;
}): Promise<string> {
  const clientId = options.clientId.trim();
  if (!clientId) {
    throw new GoogleIdentityError('unavailable');
  }

  await loadGsiClient();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new GoogleIdentityError('unavailable');
  }

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: GSI_SCOPE,
      prompt: 'select_account',
      ...(options.hd ? { hd: options.hd } : {}),
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new GoogleIdentityError(mapTokenResponseError(response.error)));
          return;
        }
        resolve(response.access_token);
      },
      error_callback: (error) => {
        reject(new GoogleIdentityError(mapClientError(error?.type)));
      },
    });
    client.requestAccessToken();
  });
}

export async function requestGoogleAccessToken(options: {
  clientId: string;
  hd?: string;
}): Promise<string> {
  try {
    return await requestGoogleAccessTokenOnce(options);
  } catch (error) {
    if (!shouldRetryGoogleAccessToken(error)) throw error;
    // Brief pause so the blocked first popup can settle before the second open.
    await wait(150);
    return requestGoogleAccessTokenOnce(options);
  }
}
