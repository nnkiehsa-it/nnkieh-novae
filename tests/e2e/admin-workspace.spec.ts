import { randomUUID } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import { actionStreamBody } from './support/backend-action';
import { newUserPage } from './support/session';

const areas = [
  ['overview', '/admin'], ['content', '/admin/content'], ['platform', '/admin/platform'],
  ['people', '/admin/people'], ['policies', '/admin/policies'], ['system', '/admin/system'], ['audit', '/admin/audit'],
] as const;

async function captureWorkspace(page: Page, path: string) {
  await page.getByRole('main').getByRole('heading', { level: 1 }).scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
  // Let route and sticky-header transitions settle before the evidence capture.
  await page.waitForTimeout(300);
  await page.screenshot({ animations: 'disabled', fullPage: true, path });
}

test('every administrative area renders on desktop and phone', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const { page, context } = await newUserPage(browser, 'admin');
  await page.addInitScript(() => localStorage.setItem('novae:locale', 'zh-TW'));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  try {
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, route] of areas) {
        await page.goto(route);
        await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible();
        await expect.poll(() => page.locator('main [data-slot="skeleton"]').count()).toBe(0);
        await expect(page.getByRole('switch')).toHaveCount(0);
        await expect(page.getByRole('spinbutton')).toHaveCount(0);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await captureWorkspace(page, testInfo.outputPath(`${name}-${width}.png`));
        if (width === 1280 && name !== 'overview') {
          const summary = page.getByRole('group', { name: '分類摘要', exact: true });
          const count = await summary.getByRole('button').count();
          expect(count).toBeGreaterThan(0);
          for (let index = 0; index < count; index += 1) {
            await summary.getByRole('button').nth(index).click();
            await expect(page.getByRole('main').getByRole('heading', { level: 2 }).first()).toBeVisible();
            await expect.poll(() => page.locator('main [data-slot="skeleton"]').count()).toBe(0);
            await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
            await page.getByRole('button', { name: '返回分類摘要', exact: true }).click();
            await expect(summary).toBeVisible();
          }
        }
      }
      for (const [name, route] of [['retention-editor', '/admin/platform?view=retention-content'], ['policy-editor', '/admin/policies?view=client']] as const) {
        await page.goto(route);
        await expect(page.getByRole('spinbutton').first()).toBeVisible();
        await expect.poll(() => page.locator('main [data-slot="skeleton"]').count()).toBe(0);
        await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
        await captureWorkspace(page, testInfo.outputPath(`${name}-${width}.png`));
      }
    }
  } finally { await context.close(); }
});

test('activity pagination preserves loaded records and retries the failed cursor', async ({ browser }, testInfo) => {
  for (const width of [1280, 390]) {
    const { page, context } = await newUserPage(browser, 'admin');
    await page.addInitScript(() => localStorage.setItem('novae:locale', 'zh-TW'));
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const cursor = { occurredAt: new Date().toISOString(), key: 'e2e-activity-page' };
    const entry = { actorUid: 'admin', kind: 'admin', occurredAt: cursor.occurredAt, targetId: 'e2e-current', title: '已載入的活動（測試資料）' };
    let attempts = 0;
    await page.route('**/v1/actions', async (route) => {
      const request = route.request().postDataJSON();
      if (request.action !== 'listAdminActivity') return route.continue();
      attempts += 1;
      expect(request.payload.cursor).toEqual(attempts === 1 ? null : cursor);
      if (attempts === 2) {
        await route.fulfill({ body: JSON.stringify({ error: { code: 'upstream-unavailable' }, operationId: randomUUID(), success: false }), contentType: 'application/json', status: 503 });
        return;
      }
      await route.fulfill({
        body: actionStreamBody({
          data: attempts === 1
            ? { entries: [entry], nextCursor: cursor }
            : { entries: [{ ...entry, targetId: 'e2e-earlier', title: '較早的活動（測試資料）' }], nextCursor: null },
          operationId: randomUUID(),
        }),
        contentType: 'application/x-ndjson', status: 200,
      });
    });
    try {
      await page.goto('/admin/audit?view=activity');
      await expect(page.getByText(entry.title, { exact: true })).toBeVisible();
      await page.getByRole('button', { name: '載入更多', exact: true }).click();
      const error = page.getByRole('main').getByRole('alert');
      await expect(error).toBeVisible();
      await expect(error.getByRole('heading')).toBeVisible();
      await expect(error.locator('p')).not.toBeEmpty();
      await expect(page.getByText(entry.title, { exact: true })).toBeVisible();
      await captureWorkspace(page, testInfo.outputPath(`activity-error-${width}.png`));
      await error.getByRole('button').click();
      await expect(page.getByText('較早的活動（測試資料）', { exact: true })).toBeVisible();
      await expect(page.getByText(entry.title, { exact: true })).toBeVisible();
      await expect(error).toHaveCount(0);
      await expect(page.getByRole('button', { name: '載入更多', exact: true })).toHaveCount(0);
      expect(attempts).toBe(3);
      await captureWorkspace(page, testInfo.outputPath(`activity-recovered-${width}.png`));
    } finally { await context.close(); }
  }
});
