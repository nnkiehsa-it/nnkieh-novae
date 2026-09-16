import { expect, test, type Locator, type Page } from '@playwright/test';
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

async function watchSheetExit(sheet: Locator, key: string) {
  await sheet.evaluate((element, reportKey) => {
    type ExitReport = {
      animations: string[];
      states: string[];
      startTop: number;
      maxTop: number;
    };
    const state = window as typeof window & {
      __novaeSheetExitReports?: Record<string, ExitReport>;
    };
    state.__novaeSheetExitReports ??= {};
    const startTop = element.getBoundingClientRect().top;
    const report = {
      animations: [] as string[],
      states: [(element as HTMLElement).dataset.state ?? ''],
      startTop,
      maxTop: startTop,
    };
    state.__novaeSheetExitReports[reportKey] = report;
    const motionFrame = element.parentElement;
    motionFrame?.addEventListener('animationstart', (event) => {
      report.animations.push((event as AnimationEvent).animationName);
    });
    new MutationObserver(() => {
      report.states.push((element as HTMLElement).dataset.state ?? '');
    }).observe(element, { attributeFilter: ['data-state'], attributes: true });
    const deadline = performance.now() + 1_200;
    const sample = () => {
      if (element.isConnected) {
        report.maxTop = Math.max(report.maxTop, element.getBoundingClientRect().top);
      }
      if (performance.now() < deadline) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, key);
}

function sheetExitReport(page: Page, key: string) {
  return page.evaluate((reportKey) => {
    type ExitReport = {
      animations: string[];
      states: string[];
      startTop: number;
      maxTop: number;
    };
    const state = window as typeof window & {
      __novaeSheetExitReports?: Record<string, ExitReport>;
    };
    return state.__novaeSheetExitReports?.[reportKey] ?? {
      animations: [],
      states: [],
      startTop: 0,
      maxTop: 0,
    };
  }, key);
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

  await page.goBack();
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
  await page.setViewportSize({ width: 390, height: 844 });
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
  const recordFrame = record.locator('..');
  await recordFrame.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  await expect(recordFrame).toHaveAttribute('data-sheet-arrived', 'true');
  await watchSheetExit(record, 'record-detail');
  const beforeClose = await record.boundingBox();
  expect(beforeClose).not.toBeNull();
  await record.getByRole('button', { name: 'Close' }).click();
  await expect(record).toHaveAttribute('data-sheet-lifecycle-closing', 'true');
  await expect(recordFrame).toHaveAttribute('data-sheet-lifecycle-closing', 'true');
  await expect(recordFrame).toHaveCSS('animation-name', 't-sheet-out');
  await page.waitForTimeout(120);
  const duringClose = await record.boundingBox();
  expect(duringClose).not.toBeNull();
  expect(duringClose!.y).toBeGreaterThan(beforeClose!.y);
  await page.waitForURL(/\/issues\/[^/]+$/u);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect.poll(async () => {
    const report = await sheetExitReport(page, 'record-detail');
    return report.maxTop - report.startTop;
  }).toBeGreaterThan(120);
  await expect(card).toBeVisible();
  await context.close();
});

test('a cancelled sheet drag settles in place without replaying its arrival', async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/issues');
  const card = page.locator('.t-card a[href^="/issues/"]').first();
  await expect(card).toBeVisible();
  const mobileNavigation = page.locator('.app-mobile-nav[data-visible="true"]');
  await expect(mobileNavigation).toBeVisible();
  const navigationBefore = await mobileNavigation.boundingBox();
  expect(navigationBefore).not.toBeNull();
  await card.click();
  await page.waitForURL(/\/issues\/[^/]+\/[^/]+$/u);

  const sheet = page.getByRole('dialog');
  const motionFrame = sheet.locator('..');
  const dragRegion = sheet.locator('[data-sheet-drag-region]').first();
  await expect(dragRegion).toBeVisible();
  await motionFrame.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  await expect(motionFrame).toHaveAttribute('data-sheet-arrived', 'true');
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
      alignContent: style.alignContent,
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
  expect(sheetMetrics.alignContent).toBe('flex-start');
  await motionFrame.evaluate((element) => {
    element.setAttribute('data-test-sheet-arrival-restarts', '0');
    element.addEventListener('animationstart', (event) => {
      if (event.animationName !== 't-sheet-in') return;
      const count = Number(element.getAttribute('data-test-sheet-arrival-restarts') ?? '0');
      element.setAttribute('data-test-sheet-arrival-restarts', String(count + 1));
    });
  });

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
  await expect(sheet).not.toHaveAttribute('data-sheet-settling', 'true');
  const postDragAnimations = await motionFrame.evaluate((element) =>
    element.getAnimations().filter((animation) => animation.playState === 'running').length,
  );
  expect(postDragAnimations).toBe(0);
  await expect(motionFrame).toHaveAttribute('data-test-sheet-arrival-restarts', '0');
  await context.close();
});

test('nested sheets keep every previous layer visible in the stack', async ({ browser }) => {
  const { context, page } = await newUserPage(browser, 'ordinary');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/issues');
  const card = page.locator('.t-card a[href^="/issues/"]').first();
  await expect(card).toBeVisible();
  await card.click();
  await page.waitForURL(/\/issues\/[^/]+\/[^/]+$/u);
  const detail = page
    .locator('[data-sheet-surface]')
    .filter({ has: page.locator('article h1') });
  await expect(detail).toBeVisible();
  const commentSort = detail.getByRole('button', { name: /Comment order|Newest first/u });
  await expect(commentSort).toBeVisible();
  await commentSort.click();

  const sheets = page.locator('[data-sheet-surface]');
  await expect(sheets).toHaveCount(2);
  const actions = sheets.last();
  await expect(actions).toBeVisible();
  const actionsHeader = actions.locator('[data-slot="dialog-header"]');
  await expect(actionsHeader).toHaveCSS('position', 'sticky');
  await expect(actionsHeader.getByRole('button', { name: /Close|關閉/u })).toHaveCount(1);
  const actionsFrame = actions.locator('..');
  await actionsFrame.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  await expect(actionsFrame).toHaveAttribute('data-sheet-arrived', 'true');
  await expect(detail).toHaveAttribute('data-sheet-depth-behind', '1');
  await expect(actions).toHaveAttribute('data-sheet-depth-behind', '0');
  await expect(detail).toHaveAttribute('data-sheet-stack-index', '0');
  await expect(actions).toHaveAttribute('data-sheet-stack-index', '1');
  const detailTransform = await detail.evaluate((element) => getComputedStyle(element).transform);
  expect(detailTransform).not.toBe('none');
  const [detailLayout, actionsLayout] = await Promise.all([
    detail.evaluate((element) => ({
      height: Number.parseFloat(getComputedStyle(element).height),
      stackInset: getComputedStyle(element).getPropertyValue('--sheet-stack-inset').trim(),
    })),
    actions.evaluate((element) => ({
      height: Number.parseFloat(getComputedStyle(element).height),
      stackInset: getComputedStyle(element).getPropertyValue('--sheet-stack-inset').trim(),
    })),
  ]);
  expect(detailLayout.stackInset).toBe('0px');
  expect(actionsLayout.stackInset).toBe('13px');
  expect(actionsLayout.height).toBeLessThan(detailLayout.height);

  await watchSheetExit(actions, 'nested-actions');
  const beforeClose = await actions.boundingBox();
  expect(beforeClose).not.toBeNull();
  await actions.getByRole('button', { name: /Close|關閉/u }).click();
  await expect(actions).toHaveAttribute('data-sheet-lifecycle-closing', 'true');
  await expect(actionsFrame).toHaveAttribute('data-sheet-lifecycle-closing', 'true');
  await expect(actionsFrame).toHaveCSS('animation-name', 't-sheet-out');
  await page.waitForTimeout(120);
  const duringClose = await actions.boundingBox();
  expect(duringClose).not.toBeNull();
  expect(duringClose!.y).toBeGreaterThan(beforeClose!.y);
  await expect(sheets).toHaveCount(1);
  await expect.poll(async () => {
    const report = await sheetExitReport(page, 'nested-actions');
    return report.maxTop - report.startTop;
  }).toBeGreaterThan(120);
  expect((await sheetExitReport(page, 'nested-actions')).maxTop -
    (await sheetExitReport(page, 'nested-actions')).startTop).toBeGreaterThan(120);
  await commentSort.click();
  await expect(sheets).toHaveCount(2);
  const reopenedFrame = sheets.last().locator('..');
  await expect.poll(async () => reopenedFrame.evaluate((element) =>
    element.getAnimations().some((animation) =>
      animation instanceof CSSAnimation && animation.animationName === 't-sheet-in',
    ),
  )).toBe(true);
  await context.close();
});

test('controlled record-backed sheets keep their exit surface mounted', async ({ browser }) => {
  const admin = await newUserPage(browser, 'admin');
  await admin.page.setViewportSize({ width: 390, height: 844 });
  await admin.page.goto('/admin/people');
  await admin.page.getByRole('tab', { name: /Access rules|限制規則/u }).click();
  await admin.page.getByRole('button', { name: /Add prefix rule|新增前綴規則/u }).click();

  const sheet = admin.page.locator('[data-sheet-surface]').last();
  await expect(sheet).toBeVisible();
  const motionFrame = sheet.locator('..');
  await motionFrame.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });
  await expect(motionFrame).toHaveAttribute('data-sheet-arrived', 'true');
  await watchSheetExit(sheet, 'prefix-rule');
  const beforeClose = await sheet.boundingBox();
  expect(beforeClose).not.toBeNull();
  await sheet.getByRole('button', { name: /Close|關閉/u }).click();
  await expect(sheet).toHaveAttribute('data-sheet-lifecycle-closing', 'true');
  await expect(motionFrame).toHaveAttribute('data-sheet-lifecycle-closing', 'true');
  await expect(motionFrame).toHaveCSS('animation-name', 't-sheet-out');
  await admin.page.waitForTimeout(120);
  const duringClose = await sheet.boundingBox();
  expect(duringClose).not.toBeNull();
  expect(duringClose!.y).toBeGreaterThan(beforeClose!.y);
  await expect(sheet).toHaveCount(0);
  await expect.poll(async () => {
    const report = await sheetExitReport(admin.page, 'prefix-rule');
    return report.maxTop - report.startTop;
  }).toBeGreaterThan(120);

  await admin.context.close();
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
