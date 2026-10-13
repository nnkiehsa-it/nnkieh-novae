import { expect, test, type Page } from '@playwright/test';
import { APP_INSTALL_PROMPT_DISMISSED_KEY } from '../../src/lib/pwa-install';
import { authStatePath } from './support/paths';
import { readContentState } from './support/content-state';
import { expectMoreActions } from './pages/content-pages';

async function suppressInstallPrompt(page: Page) {
  await page.addInitScript((dismissedKey) => {
    if (window.top === window) {
      sessionStorage.setItem(dismissedKey, '1');
    }
  }, APP_INSTALL_PROMPT_DISMISSED_KEY);
}

async function expectMobileInteractionBaseline(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);

  await expect(
    page.evaluate(() => ({
      finePointer: matchMedia('(pointer: fine)').matches,
      hover: matchMedia('(hover: hover)').matches,
    })),
  ).resolves.toEqual({ finePointer: false, hover: false });

  const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
  // The dock sits inside the screen, clear of its bottom edge.
  const navigationDockBox = await navigation.boundingBox();
  expect(navigationDockBox).not.toBeNull();
  expect(page.viewportSize()!.height - (navigationDockBox?.y ?? 0) - (navigationDockBox?.height ?? 0)).toBeGreaterThanOrEqual(0);

  for (const link of await navigation.getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
}

async function expectTouchTarget(page: Page, name: string | RegExp) {
  const control = page.getByRole('button', { name });
  await expect(control).toBeVisible();
  await expect.poll(async () => {
    const box = await control.boundingBox();
    return Math.round(Math.min(box?.width ?? 0, box?.height ?? 0));
  }).toBeGreaterThanOrEqual(44);
}

test.describe('proposal manager on mobile', () => {
  test.use({ storageState: authStatePath('issueManager') });

  test('keeps category-scoped controls and mobile navigation in sync', async ({ page }) => {
    await suppressInstallPrompt(page);
    const content = await readContentState();
    await page.goto('/issues/proposal-a');
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    await expectMobileInteractionBaseline(page);
    await page.goto(content.proposalA);
    await expect(page.getByRole('dialog', { name: 'Proposals', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);
    await expectTouchTarget(page, 'Close');
    await expectTouchTarget(page, /Support this proposal|Remove support/u);
    await expectMoreActions(page, ['Manage status', 'Delete proposal']);
    await page.goto(content.proposalB);
    await expectMoreActions(page, [], ['Manage status', 'Delete proposal']);
  });
});

test.describe('facility manager on mobile', () => {
  test.use({ storageState: authStatePath('facilityManager') });

  test('keeps facility scope identical to desktop', async ({ page }) => {
    await suppressInstallPrompt(page);
    const content = await readContentState();
    await page.goto(content.facilityA);
    await expectMoreActions(page, ['Update status', 'Delete report']);
    await page.goto(content.facilityB);
    await expectMoreActions(page, [], ['Update status', 'Delete report']);
  });
});

test.describe('ordinary owner on mobile', () => {
  test.use({ storageState: authStatePath('ordinary') });

  test('retains owner-only destructive actions', async ({ page }) => {
    await suppressInstallPrompt(page);
    const content = await readContentState();
    await page.goto(content.proposalA);
    await expectMoreActions(page, [], ['Manage status', 'Delete proposal']);
    await page.goto(content.facilityB);
    await expectMoreActions(page, [], ['Update status', 'Delete report']);
  });
});

test.describe('platform administrator on mobile', () => {
  test.use({ storageState: authStatePath('admin') });

  test('can reach protected management pages', async ({ page }) => {
    await suppressInstallPrompt(page);
    await page.goto('/issues');
    const dock = page.getByRole('navigation', { name: 'Primary navigation' });
    await expect(dock).toBeVisible({ timeout: 30_000 });
    await dock.getByRole('link', { name: 'Settings', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/u);
    await page.getByRole('link', { name: /Administration/u }).click();
    await page.waitForURL(/\/admin$/u);
    await expect(page.getByRole('main').getByRole('heading', { name: 'Administration' }))
      .toBeVisible({ timeout: 20_000 });
    // The area rail leads on to each area, and every area leads back to settings.
    await page.getByRole('main').getByRole('link', { name: 'Content and categories', exact: true }).click();
    await page.waitForURL(/\/admin\/content$/u);
    await page.getByRole('main').getByRole('link', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/\/settings$/u);
  });
});

test.describe('a link somebody shared', () => {
  test.use({ storageState: authStatePath('ordinary') });

  test('reads on its own and asks about the app only on the way out', async ({ page }) => {
    const content = await readContentState();
    await page.goto(`${content.proposalA}?shared=1`);
    const back = page.getByRole('button', { name: 'Close', exact: true });
    await expect(back).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Proposals', exact: true })).toBeVisible();

    await back.click();
    const prompt = page.getByRole('dialog');
    await expect(prompt).toBeVisible();
    await expect(prompt.getByRole('button', { name: 'Already installed' })).toBeVisible();
    await expect(prompt.getByRole('button', { name: 'Not installed yet' })).toBeVisible();

    // Staying in the browser carries on to where the way out led: the proposal's list.
    await prompt.getByRole('button', { name: 'Stay in the browser' }).click();
    await expect(page).toHaveURL(/\/feed\?view=issues/u);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
