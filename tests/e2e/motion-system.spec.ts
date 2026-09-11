import { expect, test, type Page } from '@playwright/test';
import { authStatePath } from './support/paths';
import { newUserPage } from './support/session';

function navigationDirection(page: Page) {
  return page.evaluate(() => document.documentElement.dataset.navDirection);
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

// Records which surfaces took part in each view transition the page ran, read
// at the moment the browser has created the pseudo-elements and started their
// animations, so nothing depends on catching a short animation mid-flight.
async function recordViewTransitions(page: Page) {
  await page.addInitScript(() => {
    const state = window as typeof window & { __novaeViewTransitions?: string[][] };
    state.__novaeViewTransitions = [];
    const start = document.startViewTransition?.bind(document);
    if (!start) return;
    document.startViewTransition = ((...args: Parameters<typeof start>) => {
      const transition = start(...args);
      void transition.ready
        .then(() => {
          state.__novaeViewTransitions?.push(
            document.getAnimations().flatMap((animation) => {
              const effect = animation.effect as KeyframeEffect & { pseudoElement?: string };
              const pseudo = effect?.pseudoElement ?? '';
              return /^::view-transition-(?:old|new)\(/u.test(pseudo) ? [pseudo] : [];
            }),
          );
        })
        .catch(() => undefined);
      return transition;
    }) as typeof document.startViewTransition;
  });
}

function lastViewTransition(page: Page) {
  return page.evaluate(
    () => (window as typeof window & { __novaeViewTransitions?: string[][] })
      .__novaeViewTransitions?.at(-1) ?? [],
  );
}

test('navigation direction follows the information hierarchy in both directions', async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  await recordViewTransitions(page);
  await page.goto('/issues');
  await expect(page.locator('.route-page')).toBeVisible();
  await expect(page.locator('.t-card a[href^="/issues/"]').first()).toBeVisible();

  await watchRouteChange(page);
  await page.locator('.t-card a[href^="/issues/"]').first().click();
  await page.waitForURL(/\/issues\/[^/]+\/[^/]+$/u);
  await expect(page.locator('article h1')).toBeVisible();
  await expect.poll(() => navigationDirection(page)).toBe('push');
  const forward = await routeChangeReport(page);
  expect(forward.routeSurfaces).toBe(1);
  expect(forward.viewTransition).toBe(true);

  await page.getByRole('button', { name: /^Back to/u }).click();
  await page.waitForURL(/\/issues\/[^/]+$/u);
  await expect.poll(() => navigationDirection(page)).toBe('pop');
  // Next dispatches a history traversal outside a React Transition so that Back
  // stays instant, which leaves React with nothing to animate. Going back is
  // given a view transition of its own instead, with the two route surfaces
  // named from the stylesheet rather than by the boundary.
  await expect.poll(() => lastViewTransition(page)).toEqual(
    expect.arrayContaining([
      '::view-transition-old(route-leaving)',
      '::view-transition-new(route-arriving)',
    ]),
  );

  // The browser's own Back button carries no navigation intent of its own, so
  // returning to the detail page has to be recognised as a push all the same.
  await page.goForward();
  await page.waitForURL(/\/issues\/[^/]+\/[^/]+$/u);
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
  await page.evaluate(() => {
    const state = window as typeof window & { __novaeAnsweredTap?: boolean };
    state.__novaeAnsweredTap = false;
    new MutationObserver(() => {
      if (document.querySelector('aside a[href="/announcements"][data-navigating="true"]')) {
        state.__novaeAnsweredTap = true;
      }
    }).observe(document.documentElement, {
      attributeFilter: ['data-navigating'],
      attributes: true,
      subtree: true,
    });
  });
  await destination.click();
  await page.waitForURL(/\/announcements$/u);
  await expect(page.locator('.route-page[data-route-path="/announcements"]')).toBeVisible();
  // The destination's own control wore the wait, and gave it up on arrival.
  expect(await page.evaluate(() => (window as typeof window & {
    __novaeAnsweredTap?: boolean;
  }).__novaeAnsweredTap)).toBe(true);
  await expect(page.locator('[data-navigating="true"]')).toHaveCount(0);
  await expect.poll(() => navigationDirection(page)).toBe('none');

  await context.close();
});

test('a detail route replaces its content in one surface', async ({ browser }) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  await page.goto('/issues');
  await expect(page.locator('.t-card a[href^="/issues/"]').first()).toBeVisible();
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
  await page.locator('.t-card a[href^="/issues/"]').first().click();
  await page.waitForURL(/\/issues\/[^/]+\/[^/]+$/u);
  await expect(page.locator('article h1')).toBeVisible();
  expect(await page.evaluate(() =>
    (window as typeof window & { __novaeMaxStateSurfaces?: number }).__novaeMaxStateSurfaces,
  )).toBe(1);
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
