import { expect, test } from '@playwright/test';
import { authStatePath } from './support/paths';
import { newUserPage } from './support/session';

test('navigation feedback survives the source control and route content transitions smoothly', async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  await page.goto('/issues');
  await expect(page.locator('.route-page')).toBeVisible();

  await page.evaluate(() => {
    const state = window as typeof window & {
      __novaeMaxRoutePages?: number;
      __novaeSawRouteMotion?: boolean;
      __novaeSawRouteViewTransition?: boolean;
    };
    state.__novaeMaxRoutePages = 0;
    state.__novaeSawRouteMotion = false;
    state.__novaeSawRouteViewTransition = false;
    const deadline = performance.now() + 2_000;
    const inspect = () => {
      state.__novaeMaxRoutePages = Math.max(
        state.__novaeMaxRoutePages ?? 0,
        document.querySelectorAll('.route-page').length,
      );
      if (
        document.getAnimations().some((animation) =>
          animation instanceof CSSAnimation
          && animation.animationName.startsWith('t-route-'))
      ) {
        state.__novaeSawRouteMotion = true;
      }
      if (document.getAnimations().some((animation) => {
        const effect = animation.effect as KeyframeEffect & { pseudoElement?: string };
        return effect?.pseudoElement?.includes('view-transition');
      })) state.__novaeSawRouteViewTransition = true;
      if (performance.now() < deadline) requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });

  const destination = page.locator('aside a[href="/announcements"]');
  await destination.dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' });
  await expect(page.locator('.t-navigation-echo')).toBeVisible();
  await destination.click();
  await page.waitForURL(/\/announcements$/u);

  await expect(page.locator('.route-page[data-route-path="/announcements"]')).toBeVisible();
  await expect(page.locator('.t-navigation-echo')).toBeVisible();
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as typeof window & { __novaeSawRouteMotion?: boolean }).__novaeSawRouteMotion),
  )).toBe(true);
  expect(await page.evaluate(() =>
    (window as typeof window & { __novaeMaxRoutePages?: number }).__novaeMaxRoutePages,
  )).toBe(1);
  expect(await page.evaluate(() =>
    (window as typeof window & { __novaeSawRouteViewTransition?: boolean }).__novaeSawRouteViewTransition,
  )).toBe(false);
  const stacking = await page.evaluate(() => ({
    mobileNavigation: Number.parseInt(getComputedStyle(document.querySelector('.app-mobile-nav')!).zIndex, 10),
    route: Number.parseInt(getComputedStyle(document.querySelector('.route-page')!).zIndex, 10),
  }));
  expect(stacking.mobileNavigation).toBeGreaterThan(stacking.route);

  await page.goto('/issues');
  await expect(page.locator('.t-card > a[href^="/issues/"]').first()).toBeVisible();
  await page.evaluate(() => {
    const state = window as typeof window & { __novaeMaxStateSurfaces?: number };
    state.__novaeMaxStateSurfaces = 0;
    const deadline = performance.now() + 4_000;
    const inspect = () => {
      state.__novaeMaxStateSurfaces = Math.max(
        state.__novaeMaxStateSurfaces ?? 0,
        document.querySelectorAll('.route-page > [data-state-transition]').length,
      );
      if (performance.now() < deadline) requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });
  await page.locator('.t-card > a[href^="/issues/"]').first().click();
  await page.waitForURL(/\/issues\/[^/]+\/[^/]+$/u);
  await expect(page.locator('article h1')).toBeVisible();
  expect(await page.evaluate(() =>
    (window as typeof window & { __novaeMaxStateSurfaces?: number }).__novaeMaxStateSurfaces,
  )).toBe(1);
  await context.close();
});

test('dropdowns animate their surface and items while reduced motion removes movement', async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  await page.goto('/announcements');
  const trigger = page.locator('[data-slot="dropdown-menu-trigger"]').first();
  await trigger.click();
  const content = page.locator('[data-slot="dropdown-menu-content"]');
  await expect(content).toBeVisible();
  const animationNames = await content.evaluate((element) =>
    element.getAnimations({ subtree: true }).flatMap((animation) =>
      animation instanceof CSSAnimation ? [animation.animationName] : [],
    ),
  );
  expect(animationNames).toContain('t-dropdown-in');
  expect(animationNames).toContain('t-dropdown-item-in');
  await context.close();

  const reducedContext = await browser.newContext({
    reducedMotion: 'reduce',
    storageState: authStatePath('ordinary'),
  });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto('/announcements');
  await reducedPage.locator('[data-slot="dropdown-menu-trigger"]').first().click();
  const reducedContent = reducedPage.locator('[data-slot="dropdown-menu-content"]');
  await expect(reducedContent).toBeVisible();
  await expect(reducedContent).toHaveCSS('animation-name', 'none');
  await reducedContext.close();
});
