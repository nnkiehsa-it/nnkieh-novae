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
  const navigationDock = page.locator('.app-mobile-nav');
  const navigationDockBox = await navigationDock.boundingBox();
  expect(navigationDockBox).not.toBeNull();
  const renderedBottom = await navigationDock.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).bottom),
  );
  const viewportBottomGap = page.viewportSize()!.height
    - (navigationDockBox?.y ?? 0)
    - (navigationDockBox?.height ?? 0);
  expect(viewportBottomGap).toBeGreaterThanOrEqual(0);
  expect(Math.abs(viewportBottomGap - renderedBottom))
    .toBeLessThanOrEqual(1);

  for (const link of await navigation.getByRole('link').all()) {
    const box = await link.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  }
}

async function expectTouchTarget(page: Page, name: string | RegExp) {
  const control = page.getByRole('button', { name });
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(Math.round(box?.width ?? 0)).toBeGreaterThanOrEqual(44);
  expect(Math.round(box?.height ?? 0)).toBeGreaterThanOrEqual(44);
}

test.describe('mobile route motion', () => {
  test.use({ storageState: authStatePath('ordinary') });

  test('keeps one route surface below the persistent navigation dock', async ({ page }) => {
    await suppressInstallPrompt(page);
    await page.goto('/issues');
    const dock = page.locator('.app-mobile-nav');
    await expect(dock).toBeVisible();
    await page.evaluate(() => {
      const state = window as typeof window & {
        __novaeMobileDockStayedAboveRoute?: boolean;
        __novaeMobileMaxRoutePages?: number;
      };
      state.__novaeMobileDockStayedAboveRoute = true;
      state.__novaeMobileMaxRoutePages = 0;
      const deadline = performance.now() + 2_000;
      const inspect = () => {
        const navigation = document.querySelector('.app-mobile-nav');
        if (navigation) {
          const box = navigation.getBoundingClientRect();
          const stack = document.elementsFromPoint(
            box.left + box.width / 2,
            box.top + box.height / 2,
          );
          const navigationIndex = stack.findIndex((element) => navigation.contains(element));
          const routeIndex = stack.findIndex((element) => element.classList.contains('route-page'));
          if (navigationIndex < 0 || (routeIndex >= 0 && navigationIndex > routeIndex)) {
            state.__novaeMobileDockStayedAboveRoute = false;
          }
        }
        state.__novaeMobileMaxRoutePages = Math.max(
          state.__novaeMobileMaxRoutePages ?? 0,
          document.querySelectorAll('.route-page').length,
        );
        if (performance.now() < deadline) requestAnimationFrame(inspect);
      };
      requestAnimationFrame(inspect);
    });

    await dock.locator('a[href="/announcements"]').click();
    await page.waitForURL(/\/announcements$/u);
    await expect(page.locator('.route-page[data-route-path="/announcements"]')).toBeVisible();
    expect(await page.evaluate(() =>
      (window as typeof window & { __novaeMobileMaxRoutePages?: number }).__novaeMobileMaxRoutePages,
    )).toBe(1);
    expect(await page.evaluate(() =>
      (window as typeof window & { __novaeMobileDockStayedAboveRoute?: boolean }).__novaeMobileDockStayedAboveRoute,
    )).toBe(true);
  });
});

test.describe('proposal manager on mobile', () => {
  test.use({ storageState: authStatePath('issueManager') });

  test('keeps category-scoped controls and mobile navigation in sync', async ({ page }) => {
    await suppressInstallPrompt(page);
    const content = await readContentState();
    await page.goto('/issues/proposal-a');
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    await expectMobileInteractionBaseline(page);
    await page.goto(content.proposalA);
    await expect(page.getByRole('button', { name: 'Back to proposals' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);
    await expectTouchTarget(page, 'Back to proposals');
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
    await expectMoreActions(page, ['Delete proposal'], ['Manage status']);
    await page.goto(content.facilityB);
    await expectMoreActions(page, ['Delete report'], ['Update status']);
  });
});

test.describe('platform administrator on mobile', () => {
  test.use({ storageState: authStatePath('admin') });

  test('can reach protected management pages', async ({ page }) => {
    await suppressInstallPrompt(page);
    await page.goto('/admin/management');
    await expect(page.getByRole('main').getByRole('heading', { name: 'Platform management' }))
      .toBeVisible({ timeout: 20_000 });
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/u);
  });
});
