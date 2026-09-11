import { readFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Locator } from '@playwright/test';
import { authStatePath } from './support/paths';

async function geometry(card: Locator) {
  return card.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const header = element.querySelector('[data-slot="feed-card-header"]')!.getBoundingClientRect();
    const footer = element.querySelector('[data-slot="feed-card-footer"]')!.getBoundingClientRect();
    return { width: rect.width, height: rect.height, header: header.height, footer: footer.top - rect.top };
  });
}

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`feed placeholders reserve the loaded geometry at ${viewport.width}px`, async ({ browser }) => {
    const state: Awaited<ReturnType<BrowserContext['storageState']>> = JSON.parse(await readFile(authStatePath('ordinary'), 'utf8'));
    // Preserve real authentication, but require a cold content read for this check.
    for (const origin of state.origins) {
      origin.indexedDB = origin.indexedDB?.filter((database) => database.name.startsWith('firebase'));
    }
    const context = await browser.newContext({ storageState: state, viewport, reducedMotion: 'reduce' });
    let release = () => {};
    let requested = false;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const page = await context.newPage();
    await page.route('**/v1/actions', async (route) => {
      if (route.request().postDataJSON()?.action === 'listIssues') { requested = true; await hold; }
      await route.continue();
    });
    try {
      await page.goto('/issues/proposal-a');
      await expect.poll(() => requested).toBe(true);
      const pending = page.locator('.route-card-skeleton').first();
      await expect(pending).toBeVisible();
      const before = await geometry(pending);
      const frame = await pending.elementHandle();
      release();
      const loaded = page.locator('.t-card').first();
      await expect(loaded).toBeVisible();
      const after = await geometry(loaded);
      expect(await frame!.evaluate((element) => element === document.querySelector('[data-feed-slot="0"]'))).toBe(true);
      for (const key of ['width', 'height', 'header', 'footer'] as const) {
        expect(Math.abs(before[key] - after[key]), key).toBeLessThanOrEqual(2);
      }
      expect(after.height).toBeLessThanOrEqual(220);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      // Narrow layouts keep the field behind its icon so the control row fits one line.
      if (viewport.width < 640) await page.getByRole('button', { name: 'Search titles…' }).click();
      await expect(page.getByRole('textbox', { name: /Search/u })).toBeVisible();
      const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
      await navigation.filter({ visible: true }).getByRole('link', { name: 'Announcements', exact: true }).click();
      await expect(page).toHaveURL(/\/announcements$/u);
      await expect(page.locator('.route-page')).toHaveCount(1);
    } finally {
      release();
      await context.close();
    }
  });
}
