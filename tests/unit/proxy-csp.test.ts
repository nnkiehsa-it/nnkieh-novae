import { afterEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from '../../src/proxy';

afterEach(() => vi.unstubAllEnvs());

it('permits loopback images only for development or isolated local authentication', () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('NEXT_PUBLIC_ALLOWED_DOMAIN', 'school.example');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL', 'http://127.0.0.1:9099');
  const images = () => proxy(new NextRequest('https://app.school.example/issues'))
    .headers.get('content-security-policy')!.split('; ').find((rule) => rule.startsWith('img-src'));
  expect(images()).toBe("img-src 'self' data: blob: https:");
  vi.stubEnv('NEXT_PUBLIC_ALLOWED_DOMAIN', 'integration.invalid');
  expect(images()).toContain('http://127.0.0.1:*');
  vi.stubEnv('NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL', 'https://untrusted.example');
  expect(images()).toBe("img-src 'self' data: blob: https:");
});
