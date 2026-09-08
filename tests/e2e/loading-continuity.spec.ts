import { readFile } from 'node:fs/promises';
import { expect, test, type Browser, type BrowserContext } from '@playwright/test';
import { authStatePath } from './support/paths';
import { readContentState } from './support/content-state';

async function coldContext(browser: Browser, user = 'ordinary') {
  const state: Awaited<ReturnType<BrowserContext['storageState']>> = JSON.parse(await readFile(authStatePath(user), 'utf8'));
  for (const origin of state.origins) origin.indexedDB = origin.indexedDB?.filter((database) => database.name.startsWith('firebase'));
  return browser.newContext({ storageState: state, viewport: { width: 1280, height: 800 } });
}

test('empty feed keeps its original card and resizes once without fading the surface', async ({ browser }) => {
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
      const result: { height: number; opacity: number; connected: boolean }[] = [];
      const deadline = performance.now() + 900;
      const sample = () => {
        result.push({ height: element.getBoundingClientRect().height, opacity: Number(getComputedStyle(element).opacity), connected: element.isConnected });
        if (performance.now() < deadline) requestAnimationFrame(sample); else resolve(result);
      };
      sample();
    }));
    release();
    await expect(page.locator('[data-state-transition="empty"]')).toBeVisible();
    const values = await samples;
    expect(await node!.evaluate((element) => element === document.querySelector('[data-feed-slot="0"]'))).toBe(true);
    expect(values.every((value) => value.connected && value.opacity === 1)).toBe(true);
    const first = values[0].height;
    const last = values.at(-1)!.height;
    expect(first - last).toBeGreaterThan(10);
    expect(values.some((value) => value.height < first - 1 && value.height > last + 1)).toBe(true);
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

test('only the selected tab has a colored surface and custom color controls are retired', async ({ browser }) => {
  const context = await coldContext(browser);
  const page = await context.newPage();
  await page.goto('/settings');
  const tabs = page.getByRole('tablist', { name: 'Display mode' });
  await expect(tabs).toBeVisible();
  await tabs.getByRole('tab', { name: 'Dark', exact: true }).click();
  await expect(tabs.locator('[data-displayed-active="true"]')).toHaveCount(1);
  await expect(tabs.locator('.t-tabs-pill')).toHaveCount(1);
  await expect(tabs).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  expect(await tabs.locator('.t-tabs-pill').evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  await expect(page.getByText('Custom color', { exact: true })).toHaveCount(0);
  await context.close();
});
