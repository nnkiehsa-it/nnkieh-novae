type BrowserStorageKind = 'localStorage' | 'sessionStorage';

function resolveBrowserStorage(kind: BrowserStorageKind) {
  if (typeof window === 'undefined') return null;
  try {
    return window[kind];
  } catch {
    return null;
  }
}

function read(kind: BrowserStorageKind, key: string) {
  try {
    return resolveBrowserStorage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(kind: BrowserStorageKind, key: string, value: string) {
  try {
    resolveBrowserStorage(kind)?.setItem(key, value);
  } catch {
    // Storage is an optional cache; privacy settings and quotas may disable it.
  }
}

function remove(kind: BrowserStorageKind, key: string) {
  try {
    resolveBrowserStorage(kind)?.removeItem(key);
  } catch {
    // A failed cache cleanup must not interrupt the user flow.
  }
}

export const readLocalStorage = (key: string) => read('localStorage', key);
export const readSessionStorage = (key: string) => read('sessionStorage', key);
export const writeLocalStorage = (key: string, value: string) => write('localStorage', key, value);
export const writeSessionStorage = (key: string, value: string) => write('sessionStorage', key, value);
export const removeLocalStorage = (key: string) => remove('localStorage', key);
export const removeSessionStorage = (key: string) => remove('sessionStorage', key);

export function localStorageKeys() {
  const storage = resolveBrowserStorage('localStorage');
  if (!storage) return [];
  try {
    return Array.from({ length: storage.length }, (_, index) => storage.key(index))
      .filter((key): key is string => Boolean(key));
  } catch {
    return [];
  }
}
