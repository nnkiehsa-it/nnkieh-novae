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
    const state = window as typeof window & { __novaeSawRouteMotion?: boolean };
    state.__novaeSawRouteMotion = false;
    const deadline = performance.now() + 2_000;
    const inspect = () => {
      if (
        document.getAnimations().some((animation) =>
          animation instanceof CSSAnimation
          && animation.animationName.startsWith('t-route-'))
      ) {
        state.__novaeSawRouteMotion = true;
      }
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

  await page.evaluate(() => {
    const state = window as typeof window & { __novaeSawObjectMorph?: boolean };
    state.__novaeSawObjectMorph = false;
    const deadline = performance.now() + 2_000;
    const inspect = () => {
      if (document.getAnimations().some((animation) =>
        animation instanceof CSSAnimation
        && animation.animationName.startsWith('t-object-morph-')
      )) {
        state.__novaeSawObjectMorph = true;
      }
      if (performance.now() < deadline) requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });
  await page.locator('.t-card > a[href^="/announcements/"]').first().click();
  await page.waitForURL(/\/announcements\/[^/]+$/u);
  await expect.poll(() => page.evaluate(() =>
    Boolean((window as typeof window & { __novaeSawObjectMorph?: boolean }).__novaeSawObjectMorph),
  )).toBe(true);
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
