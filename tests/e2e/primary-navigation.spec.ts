import { expect, test } from "@playwright/test";
import { authStatePath } from "./support/paths";

for (const width of [390, 1440]) {
  test(`primary navigation accepts rapid clicks and follows the rendered page at ${width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: authStatePath("ordinary"),
      viewport: { width, height: 900 },
      reducedMotion: "no-preference",
    });
    const page = await context.newPage();
    await page.goto("/announcements");
    const nav = page.locator("[data-primary-navigation]:visible");
    await nav.waitFor();
    await page.evaluate(() => {
      const state = window as typeof window & { primarySnapshots: number };
      state.primarySnapshots = 0;
      const start = document.startViewTransition.bind(document);
      document.startViewTransition = (...args: Parameters<typeof start>) => {
        state.primarySnapshots += 1;
        return start(...args);
      };
    });
    const paths = ["/notifications", "/settings", "/announcements"];
    for (const href of paths) {
      await nav.locator(`a[href="${href}"]`).click();
      await expect(page.locator(".route-page")).toHaveAttribute(
        "data-route-path",
        href,
      );
    }
    const notification = nav.locator('a[href="/notifications"]');
    await notification.dispatchEvent("pointerdown", {
      button: 0,
      pointerType: "touch",
    });
    await notification.dispatchEvent("pointercancel", { pointerType: "touch" });
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
      "href",
      "/announcements",
    );
    const points = new Map<string, { x: number; y: number }>();
    for (const href of paths) {
      const box = (await nav.locator(`a[href="${href}"]`).boundingBox())!;
      points.set(href, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    }
    await page.evaluate(() => {
      const state = window as typeof window & { receivedTabs: string[] };
      state.receivedTabs = [];
      document.addEventListener(
        "click",
        (event) => {
          const link = (event.target as Element).closest<HTMLAnchorElement>(
            "[data-primary-navigation] a",
          );
          if (link) state.receivedTabs.push(link.pathname);
        },
        true,
      );
    });
    const sequence = [...paths, ...paths, "/settings", "/notifications"];
    for (const href of sequence) {
      const point = points.get(href)!;
      // Coordinates deliberately bypass Playwright's stability wait: users can
      // tap the next destination before the previous animation has settled.
      await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(35);
    }
    await expect(page).toHaveURL(/\/notifications$/u);
    await expect(page.locator(".route-page")).toHaveCount(1);
    await expect(page.locator(".route-page")).toHaveAttribute(
      "data-route-path",
      "/notifications",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
      "href",
      "/notifications",
    );
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { receivedTabs: string[] }).receivedTabs,
      ),
    ).toEqual(sequence);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await page.evaluate(
        () =>
          (window as typeof window & { primarySnapshots: number })
            .primarySnapshots,
      ),
    ).toBe(0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await nav.locator('a[href="/settings"]').click();
    await expect(page.locator(".route-page")).toHaveAttribute(
      "data-route-path",
      "/settings",
    );
    await expect(page.locator(".route-page")).toHaveCSS(
      "animation-name",
      "none",
    );
    await context.close();
  });
}

test("a pending destination never claims to be the displayed page", async ({
  browser,
}) => {
  const context = await browser.newContext({
    serviceWorkers: "block",
    storageState: authStatePath("ordinary"),
  });
  const page = await context.newPage();
  let release = () => {};
  let interceptedSettingsRequests = 0;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/settings(?:\?|$)/u, async (route) => {
    interceptedSettingsRequests += 1;
    await pending;
    await route.continue();
  });
  try {
    await page.goto("/announcements");
    const nav = page.locator("[data-primary-navigation]:visible");
    await nav.locator('a[href="/settings"]').click();
    await expect.poll(() => interceptedSettingsRequests).toBeGreaterThan(0);
    await expect(
      nav.locator('a[href="/settings"] .t-nav-pending'),
    ).toHaveAttribute("data-pending", "true");
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
      "href",
      "/announcements",
    );
    await expect(page.locator(".route-page")).toHaveAttribute(
      "data-route-path",
      "/announcements",
    );
    release();
    await expect(page.locator(".route-page")).toHaveAttribute(
      "data-route-path",
      "/settings",
    );
    await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
      "href",
      "/settings",
    );
    await expect(nav.locator('[data-pending="true"]')).toHaveCount(0);
  } finally {
    release();
    await context.close();
  }
});
