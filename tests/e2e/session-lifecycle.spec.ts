import { expect, test } from '@playwright/test';
import { newUserPage } from './support/session';
import { expectBackendAction } from './support/backend-action';
import { withRuntimeEnvironment } from '../../cloudflare/src/backend/shared/env';
import { createMediaDeliveryUrl } from '../../cloudflare/src/backend/shared/media-delivery';
import type { Env } from '../../cloudflare/src/types';

test('logout revokes the current device and removes the service-worker push session', async ({ browser }) => {
  const { page, context } = await newUserPage(browser, 'ordinary');
  try {
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await page.evaluate(async () => {
      localStorage.setItem('novae:push-device-id', 'logout-e2e-device');
      localStorage.setItem('novae:push-confirmed-uid', 'previous-account');
      const cache = await caches.open('novae-push-session-v1');
      await cache.put(new URL('/__novae/push-session', location.origin).href, Response.json({ uid: 'previous-account' }));
    });
    await expectBackendAction(page, 'unregisterPushToken', () => page.getByRole('button', { name: 'Sign out', exact: true }).click());
    await expect(page).toHaveURL(/\/login/u);
    expect(await page.evaluate(async () => Boolean(await caches.match(new URL('/__novae/push-session', location.origin).href, { cacheName: 'novae-push-session-v1' })))).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('novae:push-confirmed-uid'))).toBe('');
  } finally { await context.close(); }
});

test('the service worker never caches signed private media', async ({ browser }) => {
  const { page, context } = await newUserPage(browser, 'ordinary');
  try {
    await page.goto('/issues');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.reload();
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
    const media = await withRuntimeEnvironment({
      PUBLIC_API_URL: process.env.WORKER_URL ?? 'http://127.0.0.1:8787',
      MEDIA_SIGNING_SECRET: 'integration-media-signing-secret-that-is-long-enough',
    } as Env, () => createMediaDeliveryUrl('srp/private-cache-regression', 'full', true, 'cache-regression'));
    await page.evaluate((url) => new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('private media did not load'));
      image.src = url;
    }), media.url);
    // Runtime cache writes use waitUntil and can finish after the image's load event.
    await page.waitForTimeout(300);
    expect(await page.evaluate(async (url) => Boolean(await caches.match(url)), media.url)).toBe(false);
  } finally { await context.close(); }
});

test('a backslash redirect cannot send a signed-in user to another origin', async ({ browser }) => {
  const { page, context } = await newUserPage(browser, 'ordinary');
  try {
    await page.route('**://evil.invalid/**', (route) => route.abort());
    await page.goto(`/login?redirect=${encodeURIComponent('/\\evil.invalid')}`);
    await expect(page).toHaveURL(/\/issues(?:\/|\?|$)/u);
    expect(new URL(page.url()).origin).toBe(new URL(process.env.NOVAE_E2E_BASE_URL ?? 'http://127.0.0.1:3000').origin);
  } finally { await context.close(); }
});
