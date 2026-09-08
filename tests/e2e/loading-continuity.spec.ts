import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { authStatePath } from './support/paths';
import { readContentState } from './support/content-state';
import { newUserPage } from './support/session';

function failedActionBody() {
  return JSON.stringify({
    error: { code: 'upstream-unavailable' },
    operationId: randomUUID(),
    success: false,
  });
}

async function coldContext(browser: Browser, user = 'ordinary') {
  const state: Awaited<ReturnType<BrowserContext['storageState']>> = JSON.parse(await readFile(authStatePath(user), 'utf8'));
  for (const origin of state.origins) origin.indexedDB = origin.indexedDB?.filter((database) => database.name.startsWith('firebase'));
  return browser.newContext({ storageState: state, viewport: { width: 1280, height: 800 } });
}

test('empty feed keeps its original card and settles without fading the surface', async ({ browser }) => {
  const context = await coldContext(browser);
  const page = await context.newPage();
  let release = () => {};
  let started = false;
  const hold = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/v1/actions', async (route) => {
    if (route.request().postDataJSON()?.action !== 'listIssues') return route.continue();
    started = true;
    const response = await route.fetch();
    const body = await response.json();
    await hold;
    await route.fulfill({ response, json: { ...body, data: { ...body.data, issues: [], hasMore: false, cursor: null } } });
  });
  try {
    await page.goto('/issues/proposal-a');
    await expect.poll(() => started).toBe(true);
    const frame = page.locator('[data-feed-slot="0"]');
    await expect(frame).toBeVisible();
    const node = await frame.elementHandle();
    const samples = frame.evaluate((element) => new Promise<{ height: number; opacity: number; connected: boolean }[]>((resolve) => {
      element.setAttribute('data-sampling', 'true');
      const result: { height: number; opacity: number; connected: boolean }[] = [];
      const deadline = performance.now() + 900;
      const sample = () => {
        result.push({ height: element.getBoundingClientRect().height, opacity: Number(getComputedStyle(element).opacity), connected: element.isConnected });
        if (performance.now() < deadline) requestAnimationFrame(sample); else resolve(result);
      };
      sample();
    }));
    await expect(frame).toHaveAttribute('data-sampling', 'true');
    release();
    await expect(page.locator('[data-state-transition="empty"]')).toBeVisible();
    const values = await samples;
    expect(await node!.evaluate((element) => element === document.querySelector('[data-feed-slot="0"]'))).toBe(true);
    expect(values.every((value) => value.connected && value.opacity === 1)).toBe(true);
    const first = values[0].height;
    const last = values.at(-1)!.height;
    expect(first - last).toBeGreaterThan(10);
    expect(values.some((value) => value.height < first - 1 && value.height > last + 1)).toBe(false);
    expect(Math.max(...values.map((value) => value.height))).toBeLessThanOrEqual(first + 1);
    expect(await frame.evaluate((element) => element.getAnimations().filter((animation) => animation.id === 'novae-resize').length)).toBe(0);
  } finally { release(); await context.close(); }
});

for (const kind of ['proposalA', 'facilityA', 'announcement'] as const) {
  test(`${kind} retains the detail card when its delayed record arrives`, async ({ browser }) => {
    const context = await coldContext(browser);
    const page = await context.newPage();
    const content = await readContentState();
    const action = { proposalA: 'getIssue', facilityA: 'getFacility', announcement: 'getAnnouncement' }[kind];
    let release = () => {};
    let started = false;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    await page.route('**/v1/actions', async (route) => {
      if (route.request().postDataJSON()?.action === action) { started = true; await hold; }
      await route.continue();
    });
    try {
      await page.goto(content[kind]);
      await expect.poll(() => started).toBe(true);
      const frame = page.locator('[data-detail-card="content"]');
      await expect(frame).toBeVisible();
      const node = await frame.elementHandle();
      release();
      await expect(frame.getByRole('heading', { level: 1 })).toBeVisible();
      expect(await node!.evaluate((element) => element === document.querySelector('[data-detail-card="content"]'))).toBe(true);
      await expect(frame).toHaveCSS('opacity', '1');
    } finally { release(); await context.close(); }
  });
}

test('feed error retry retains its card slot and resolves without a surface fade', async ({ browser }) => {
  const context = await coldContext(browser);
  const page = await context.newPage();
  let attempts = 0;
  await page.route('**/v1/actions', async (route) => {
    if (route.request().postDataJSON()?.action === 'listIssues' && attempts++ === 0) {
      await route.fulfill({
        body: failedActionBody(),
        contentType: 'application/json',
        status: 503,
      });
      return;
    }
    await route.continue();
  });
  try {
    await page.goto('/issues/proposal-a');
    await expect.poll(() => attempts).toBe(1);
    const frame = page.locator('[data-feed-slot="0"]');
    const surface = page.locator('[data-state-transition]');
    const node = await frame.elementHandle();
    await expect(surface).toHaveAttribute('data-state-transition', 'error');
    await expect(frame.getByRole('button', { name: 'Reload' })).toBeVisible();
    await frame.getByRole('button', { name: 'Reload' }).click();
    await expect.poll(() => attempts).toBe(2);
    await expect(surface).toHaveAttribute('data-state-transition', 'content');
    await expect(frame).toHaveClass(/t-card/u);
    expect(await node!.evaluate((element) => element === document.querySelector('[data-feed-slot="0"]'))).toBe(true);
    await expect(page.locator('[data-state-transition="content"]')).toHaveCSS('opacity', '1');
  } finally {
    await context.close();
  }
});

test('feed query, clear, sort, and status changes keep the physical card slot', async ({ browser }) => {
  const context = await coldContext(browser);
  const page = await context.newPage();
  try {
    await page.goto('/issues/proposal-a');
    const frame = page.locator('[data-feed-slot="0"]');
    await expect(frame).toHaveClass(/t-card/u);
    const node = await frame.elementHandle();

    const search = page.getByRole('textbox', { name: 'Search titles…' });
    await search.fill(`no matching title ${Date.now()}`);
    await search.press('Enter');
    await expect(page.locator('[data-state-transition="empty"]')).toBeVisible();
    expect(await node!.evaluate((element) => element === document.querySelector('[data-feed-slot="0"]'))).toBe(true);

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(frame).toHaveClass(/t-card/u);
    await page.getByRole('combobox', { name: 'Sort order' }).click();
    await page.getByRole('option', { name: 'Most supported' }).click();
    await expect(frame).toHaveClass(/t-card/u);
    await page.locator('[data-liquid-tab="closed"]').click();
    await expect(page.locator('[data-state-transition="empty"], [data-state-transition="content"]')).toBeVisible();
    expect(await node!.evaluate((element) => element === document.querySelector('[data-feed-slot="0"]'))).toBe(true);
  } finally {
    await context.close();
  }
});

for (const kind of ['proposalA', 'facilityA', 'announcement'] as const) {
  test(`${kind} detail error retry retains the main card`, async ({ browser }) => {
    const context = await coldContext(browser);
    const page = await context.newPage();
    const content = await readContentState();
    const action = { proposalA: 'getIssue', facilityA: 'getFacility', announcement: 'getAnnouncement' }[kind];
    let attempts = 0;
    await page.route('**/v1/actions', async (route) => {
      if (route.request().postDataJSON()?.action === action && attempts++ === 0) {
        await route.fulfill({
          body: failedActionBody(),
          contentType: 'application/json',
          status: 503,
        });
        return;
      }
      await route.continue();
    });
    try {
      await page.goto(content[kind]);
      await expect.poll(() => attempts).toBe(1);
      const frame = page.locator('[data-detail-card="content"]');
      const node = await frame.elementHandle();
      await expect(page.locator('[data-state-transition="error"]')).toBeVisible();
      await expect(frame.getByRole('button', { name: 'Reload' })).toBeVisible();
      await frame.getByRole('button', { name: 'Reload' }).click();
      await expect.poll(() => attempts).toBe(2);
      await expect(page.locator('[data-state-transition="content"]')).toBeVisible();
      await expect(frame.getByRole('button', { name: 'Reload' })).toHaveCount(0);
      await expect(frame.getByRole('heading', { level: 1 })).not.toHaveText('Failed to load');
      expect(await node!.evaluate((element) => element === document.querySelector('[data-detail-card="content"]'))).toBe(true);
    } finally {
      await context.close();
    }
  });
}

test('notifications error retry retains the notification surface', async ({ browser }) => {
  const context = await coldContext(browser, 'other');
  const page = await context.newPage();
  let attempts = 0;
  await page.route('**/v1/actions', async (route) => {
    if (route.request().postDataJSON()?.action === 'getNotificationSnapshot' && attempts++ === 0) {
      await route.fulfill({
        body: failedActionBody(),
        contentType: 'application/json',
        status: 503,
      });
      return;
    }
    await route.continue();
  });
  try {
    await page.goto('/notifications');
    await expect.poll(() => attempts).toBe(1);
    const surface = page.locator('[data-notification-surface]');
    const node = await surface.elementHandle();
    await expect(surface.locator('[data-error="true"]')).toBeVisible();
    await surface.getByRole('button', { name: 'Reload' }).click();
    await expect.poll(() => attempts).toBe(2);
    await expect(surface.locator('[data-error="true"]')).toHaveCount(0);
    await expect(surface).toHaveAttribute('aria-busy', 'false');
    expect(await node!.evaluate((element) => element === document.querySelector('[data-notification-surface]'))).toBe(true);
  } finally {
    await context.close();
  }
});

test('dashboard error retry retains unknown metrics until data arrives', async ({ browser }) => {
  const { context, page } = await newUserPage(browser, 'admin');
  let attempts = 0;
  await page.route('**/v1/actions', async (route) => {
    if (route.request().postDataJSON()?.action === 'getPlatformDashboard' && attempts++ === 0) {
      await route.fulfill({
        body: failedActionBody(),
        contentType: 'application/json',
        status: 503,
      });
      return;
    }
    await route.continue();
  });
  try {
    await page.goto('/dashboard');
    await expect.poll(() => attempts).toBe(1);
    const surface = page.locator('[data-dashboard-surface]');
    const node = await surface.elementHandle();
    await expect(surface.locator('[data-error="true"]')).toBeVisible();
    await expect(surface.locator('[data-slot="skeleton"]').first()).toBeVisible();
    await surface.getByRole('button', { name: 'Reload' }).click();
    await expect.poll(() => attempts).toBe(2);
    await expect(surface.locator('[data-error="true"]')).toHaveCount(0);
    expect(await node!.evaluate((element) => element === document.querySelector('[data-dashboard-surface]'))).toBe(true);
  } finally {
    await context.close();
  }
});

test('administration tabs retain one content wrapper while changing domains', async ({ browser }) => {
  const { context, page } = await newUserPage(browser, 'admin');
  try {
    await page.goto('/admin/management?tab=overview');
    const content = page.locator('[data-admin-content]');
    await expect(content).toBeVisible();
    const node = await content.elementHandle();
    for (const tab of ['overview', 'users', 'categories', 'members', 'audit']) {
      await page.locator(`[data-liquid-tab="${tab}"]`).click();
      await expect(page.locator(`[data-liquid-tab="${tab}"][data-displayed-active="true"]`)).toBeVisible();
      await expect(content).toBeVisible();
      expect(await node!.evaluate((element) => element === document.querySelector('[data-admin-content]'))).toBe(true);
    }
  } finally {
    await context.close();
  }
});

test('selected tabs use the brand surface while inactive tabs retain a neutral rail', async ({ browser }) => {
  const context = await coldContext(browser);
  const page = await context.newPage();
  await page.goto('/settings');
  const tabs = page.getByRole('tablist', { name: 'Display mode' });
  await expect(tabs).toBeVisible();
  await tabs.getByRole('tab', { name: 'Dark', exact: true }).click();
  await expect(tabs.locator('[data-displayed-active="true"]')).toHaveCount(1);
  await expect(tabs.locator('.t-tabs-pill')).toHaveCount(1);
  const railColor = await tabs.evaluate((element) => getComputedStyle(element).backgroundColor);
  const pillColor = await tabs.locator('.t-tabs-pill').evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(railColor).not.toBe('rgba(0, 0, 0, 0)');
  expect(railColor).not.toBe(pillColor);
  await expect(page.getByText('Custom color', { exact: true })).toHaveCount(0);
  await context.close();
});
