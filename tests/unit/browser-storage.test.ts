import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readLocalStorage,
  readSessionStorage,
  removeLocalStorage,
  writeLocalStorage,
  writeSessionStorage,
} from '@/lib/browser-storage';

describe('browser storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('persists local and session values', () => {
    writeLocalStorage('local-key', 'local-value');
    writeSessionStorage('session-key', 'session-value');

    expect(readLocalStorage('local-key')).toBe('local-value');
    expect(readSessionStorage('session-key')).toBe('session-value');

    removeLocalStorage('local-key');
    expect(readLocalStorage('local-key')).toBeNull();
  });

  it('treats blocked storage as an unavailable optional cache', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(readLocalStorage('blocked')).toBeNull();
    expect(() => writeLocalStorage('blocked', 'value')).not.toThrow();
  });
});
