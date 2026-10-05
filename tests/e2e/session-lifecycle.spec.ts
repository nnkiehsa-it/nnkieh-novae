import { expect, test } from '@playwright/test';
import { newUserPage } from './support/session';
import { expectBackendAction } from './support/backend-action';
import { withRuntimeEnvironment } from '../../cloudflare/src/backend/shared/env';
import { createMediaDeliveryUrl } from '../../cloudflare/src/backend/shared/media-delivery';
import type { Env } from '../../cloudflare/src/types';
import { PERSISTENT_CACHE_NAMESPACE } from '../../src/lib/persistent-cache';

test('a warm startup shows its steps and opens the shell while the daily bootstrap is stalled', async ({ browser }) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  let release!: () => void;
  const stalled = new Promise<void>((resolve) => { release = resolve; });
  let requests = 0;
  try {
    await page.goto('/settings');
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(async (namespace) => {
      const open = indexedDB.open(namespace);
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        open.onsuccess = () => resolve(open.result);
        open.onerror = () => reject(open.error);
      });
      try {
        const read = database.transaction('entries').objectStore('entries').getAll();
        const entries = await new Promise<Array<{ cacheKey: string }>>((resolve) => { read.onsuccess = () => resolve(read.result); });
        return entries.some((entry) => entry.cacheKey === 'session-bootstrap-v2');
      } finally { database.close(); }
    }, PERSISTENT_CACHE_NAMESPACE)).toBe(true);
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith('novae:platform-visit-recorded-at:')) localStorage.removeItem(key);
      }
    });
    await page.addInitScript(() => {
      const phases: Array<{ phase: string; at: number }> = [];
      Object.assign(window, { startupPhases: phases });
      new MutationObserver(() => {
        const phase = document.querySelector<HTMLElement>('.t-startup-status')?.dataset.phase;
        if (phase && phase !== phases.at(-1)?.phase) phases.push({ phase, at: performance.now() });
      }).observe(document, { childList: true, subtree: true });
    });
    await page.route('**/v1/actions', async (route) => {
      if (route.request().postDataJSON()?.action === 'getSessionBootstrap') {
        requests += 1;
        await stalled;
      }
      await route.continue();
    });
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible({ timeout: 2_000 });
    await expect(page.locator('.app-start-surface')).toHaveCount(0);
    expect(requests).toBe(1);
    const phases = await page.evaluate(() => (window as typeof window & { startupPhases: Array<{ phase: string; at: number }> }).startupPhases);
    expect(phases.map(({ phase }) => phase)).toEqual(['session', 'security', 'account', 'access', 'ready']);
    const duration = phases.at(-1)!.at - phases[0].at;
    expect(duration).toBeGreaterThanOrEqual(250);
    expect(duration).toBeLessThan(1_000);
    console.log(`Warm startup phases: ${phases.map(({ phase }) => phase).join(' → ')} (${Math.round(duration)}ms to ready, bootstrap still pending)`);
  } finally {
    release();
    await context.close();
  }
});

test('a failed startup retries in place without falling through to setup', async ({ browser }) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  // Saved auth fixtures include a warm access snapshot. This regression needs
  // a cold content cache so a failed access request really blocks startup.
  await page.goto('/version.json');
  await page.evaluate((namespace) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(namespace);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }), PERSISTENT_CACHE_NAMESPACE);
  let attempts = 0;
  let granularReads = 0;
  await page.route('**/v1/actions', async (route) => {
    const action = route.request().postDataJSON()?.action;
    if (action === 'getCurrentUserRole') granularReads += 1;
    if (action === 'getSessionBootstrap' && attempts++ === 0) {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'upstream-unavailable' } }) });
    } else await route.continue();
  });
  try {
    await page.goto('/announcements');
    await expect(page.getByRole('alert').filter({ hasText: 'Unable to load your account' })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/announcements');
    expect(granularReads).toBe(0);
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Announcements', exact: true })).toBeVisible();
    expect(attempts).toBe(2);
  } finally { await context.close(); }
});

test('a failed login preparation can be retried without reloading the page', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      localStorage.setItem('novae:locale', 'en');
      sessionStorage.setItem('novae:app-install-prompt-dismissed', '1');
      // Fail the real entrance check before it touches a Google popup.
      Object.defineProperty(navigator, 'userAgent', { configurable: true, value: 'Instagram' });
    });
    await page.goto('/login');
    const retry = page.getByRole('button', { name: 'Retry verification' });
    await expect(retry).toBeEnabled();
    await expect(page.getByRole('main').getByRole('alert')).toContainText('system browser');
    await retry.click();
    await expect(retry).toBeEnabled();
    await page.evaluate(() => { Reflect.deleteProperty(navigator, 'userAgent'); });
    await retry.click();
    await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeEnabled();
    await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
      await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeInViewport();
    }
  } finally { await context.close(); }
});

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
    await expect(page).toHaveURL(/\/home$/u);
    expect(new URL(page.url()).origin).toBe(new URL(process.env.NOVAE_E2E_BASE_URL ?? 'http://127.0.0.1:3000').origin);
  } finally { await context.close(); }
});
