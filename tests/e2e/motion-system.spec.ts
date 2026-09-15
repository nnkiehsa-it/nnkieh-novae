import { expect, test, type Page } from '@playwright/test';
import { authStatePath } from './support/paths';
import { newUserPage } from './support/session';

function navigationDirection(page: Page) {
  return page.evaluate(
    () => document.querySelector<HTMLElement>('.route-page')?.dataset.routeDirection,
  );
}

// Samples the live document across a navigation: how many route surfaces ever
// coexist, and whether the browser actually ran a view transition for it.
async function watchRouteChange(page: Page) {
  await page.evaluate(() => {
    const state = window as typeof window & {
      __novaeMaxRoutePages?: number;
      __novaeSawRouteViewTransition?: boolean;
    };
    state.__novaeMaxRoutePages = 0;
    state.__novaeSawRouteViewTransition = false;
    const deadline = performance.now() + 3_000;
    const inspect = () => {
      state.__novaeMaxRoutePages = Math.max(
        state.__novaeMaxRoutePages ?? 0,
        document.querySelectorAll('.route-page').length,
      );
      if (document.getAnimations().some((animation) => {
        const effect = animation.effect as KeyframeEffect & { pseudoElement?: string };
        return effect?.pseudoElement?.includes('view-transition');
      })) state.__novaeSawRouteViewTransition = true;
      if (performance.now() < deadline) requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });
}

function routeChangeReport(page: Page) {
  return page.evaluate(() => {
    const state = window as typeof window & {
      __novaeMaxRoutePages?: number;
      __novaeSawRouteViewTransition?: boolean;
    };
    return {
      routeSurfaces: state.__novaeMaxRoutePages,
      viewTransition: Boolean(state.__novaeSawRouteViewTransition),
    };
  });
}

test('navigation direction follows the information hierarchy in both directions', async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  await page.goto('/issues');
  await expect(page.locator('.route-page')).toBeVisible();
  // A record is shown over the list it is in rather than instead of it, so the
  // move that goes deeper in the hierarchy is the one that replaces the page:
  // writing a proposal rather than reading one.
  const compose = page.getByRole('link', { name: 'New proposal' });
  await expect(compose).toBeVisible();

  await watchRouteChange(page);
  await compose.click();
  await page.waitForURL(/\/issues\/[^/]+\/new$/u);
  await expect.poll(() => navigationDirection(page)).toBe('push');
  const forward = await routeChangeReport(page);
  expect(forward.routeSurfaces).toBe(1);
  // The page arriving is revealed in the live document. Capturing it instead
  // rasterises both pages while the browser is still fetching and rendering the
  // route that was asked for, and suspends hit testing for the whole animation.
  expect(forward.viewTransition).toBe(false);
  await expect(page.locator('.route-page')).toHaveCSS(
    'animation-name',
    't-route-enter',
  );

  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await page.waitForURL(/\/issues\/[^/]+$/u);
  await expect.poll(() => navigationDirection(page)).toBe('pop');
  // Next dispatches a history traversal outside a React Transition so that Back
  // stays instant. The reveal belongs to the page that arrives, so a traversal
  // animates on exactly the same recipe as any other navigation and needs no
  // transition of its own.
  await expect(page.locator('.route-page')).toHaveCSS(
    'animation-name',
    't-route-enter',
  );

  // The browser's own Back button carries no navigation intent of its own, so
  // returning to the detail page has to be recognised as a push all the same.
  await page.goForward();
  await page.waitForURL(/\/issues\/[^/]+\/new$/u);
  await expect.poll(() => navigationDirection(page)).toBe('push');
  await page.goBack();
  await page.waitForURL(/\/issues\/[^/]+$/u);
  await expect.poll(() => navigationDirection(page)).toBe('pop');

  // Switching primary navigation is a replacement, not a move through the
  // hierarchy, and must not read as either direction.
  const destination = page.locator('aside a[href="/announcements"]');
  // Touching a destination is not asking for it: a touch that turns into a
  // scroll must leave nothing behind, so only the click answers.
  await destination.dispatchEvent('pointerdown', { button: 0, pointerType: 'mouse' });
  await expect(page.locator('[data-navigating="true"]')).toHaveCount(0);
  await expect(destination).not.toHaveAttribute('aria-current', 'page');
  await destination.click();
  await page.waitForURL(/\/announcements$/u);
  await expect(page.locator('.route-page[data-route-path="/announcements"]')).toBeVisible();
  await expect(destination).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('[data-navigating="true"]')).toHaveCount(0);
  await expect.poll(() => navigationDirection(page)).toBe('none');

  await context.close();
});

test('a record replaces its content in one surface, over the list it came from', async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  await page.goto('/issues');
  const card = page.locator('.t-card a[href^="/issues/"]').first();
  await expect(card).toBeVisible();
  const feed = await page.locator('.route-page').getAttribute('data-route-path');
  await page.evaluate(() => {
    const state = window as typeof window & { __novaeMaxStateSurfaces?: number };
    state.__novaeMaxStateSurfaces = 0;
    const deadline = performance.now() + 4_000;
    const inspect = () => {
      state.__novaeMaxStateSurfaces = Math.max(
        state.__novaeMaxStateSurfaces ?? 0,
        // The record's own surface, not the ones nested inside it: the
        // discussion carries a surface of its own, and what this is watching
        // for is a second copy of the record stacked on the first.
        [...document.querySelectorAll('[data-slot="dialog-content"] [data-state-transition]')]
          .filter((surface) => !surface.parentElement?.closest('[data-state-transition]'))
          .length,
      );
      if (performance.now() < deadline) requestAnimationFrame(inspect);
    };
    requestAnimationFrame(inspect);
  });
  await card.click();
  await page.waitForURL(/\/issues\/[^/]+\/[^/]+$/u);
  const record = page.getByRole('dialog');
  await expect(record.locator('article h1')).toBeVisible();
  await expect(record.locator('.detail-header')).toHaveCSS('position', 'sticky');
  expect(await record.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  // One surface inside the record, never two stacked while it arrives.
  expect(await page.evaluate(() =>
    (window as typeof window & { __novaeMaxStateSurfaces?: number }).__novaeMaxStateSurfaces,
  )).toBe(1);
  // The page underneath is still the list: same surface, same element, and the
  // address in the bar is the record's own so it can still be sent to somebody.
  await expect(page.locator('.route-page')).toHaveCount(1);
  await expect(page.locator('.route-page')).toHaveAttribute('data-route-path', feed ?? '');

  await expect(record.getByRole('button', { name: 'Close' })).toBeVisible();
  await expect(record.getByRole('button', { name: /^Back to/u })).toHaveCount(0);
  await expect(record.locator('[data-slot="sheet-drag-handle"]')).toHaveCount(0);
  await expect(record.locator('[data-sheet-drag-region]')).not.toHaveCount(0);
  await record.getByRole('button', { name: 'Close' }).click();
  await page.waitForURL(/\/issues\/[^/]+$/u);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(card).toBeVisible();
  await context.close();
});

test('a cancelled sheet drag settles in place without replaying its arrival', async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/issues');
  const mobileNavigation = page.locator('.app-mobile-nav[data-visible="true"]');
  await expect(mobileNavigation).toBeVisible();
  const navigationBefore = await mobileNavigation.boundingBox();
  expect(navigationBefore).not.toBeNull();
  await page.locator('.t-card a[href^="/issues/"]').first().click();
  await page.waitForURL(/\/issues\/[^/]+\/[^/]+$/u);

  const sheet = page.getByRole('dialog');
  const dragRegion = sheet.locator('[data-sheet-drag-region]').first();
  await expect(dragRegion).toBeVisible();
  await sheet.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  const navigationAfter = await mobileNavigation.boundingBox();
  expect(navigationAfter).not.toBeNull();
  expect(navigationAfter!.x).toBeCloseTo(navigationBefore!.x, 1);
  expect(navigationAfter!.y).toBeCloseTo(navigationBefore!.y, 1);
  expect(navigationAfter!.width).toBeCloseTo(navigationBefore!.width, 1);
  expect(navigationAfter!.height).toBeCloseTo(navigationBefore!.height, 1);

  const sheetMetrics = await sheet.evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    const frame = element.parentElement?.getBoundingClientRect();
    return {
      height: box.height,
      availableHeight: frame ? frame.bottom - box.top : box.height,
      paddingLeft: Number.parseFloat(style.paddingLeft),
      paddingRight: Number.parseFloat(style.paddingRight),
    };
  });
  const pagePadding = await page.locator('.route-page').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      left: Number.parseFloat(style.paddingLeft),
      right: Number.parseFloat(style.paddingRight),
    };
  });
  expect(sheetMetrics.height).toBeCloseTo(sheetMetrics.availableHeight, 1);
  expect(sheetMetrics.paddingLeft).toBeCloseTo(pagePadding.left, 1);
  expect(sheetMetrics.paddingRight).toBeCloseTo(pagePadding.right, 1);
  await expect(sheet).toHaveAttribute('data-sheet-drag-interacted', 'true');
  await expect(sheet).toHaveCSS('animation-name', 'none');

  const box = await dragRegion.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(120);
  await page.mouse.move(x, y + 36, { steps: 4 });
  await page.waitForTimeout(120);
  await page.mouse.up();

  await expect(sheet).toBeVisible();
  await expect(sheet).toHaveAttribute('data-sheet-drag-interacted', 'true');
  await expect(sheet).not.toHaveAttribute('data-sheet-settling', 'true');
  await expect(sheet).toHaveCSS('animation-name', 'none');
  await context.close();
});

test('dropdowns animate as one surface while reduced motion removes movement', async ({
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
  // The menu opens as a single object: its items are carried by the surface
  // rather than each arriving on its own delay.
  expect(animationNames).toEqual(['t-dropdown-in']);
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
