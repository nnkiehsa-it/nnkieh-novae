import { expect, test, type Locator, type Page } from "@playwright/test";
import { authStatePath } from "./support/paths";
import { newUserPage } from "./support/session";

async function settle(surface: Locator) {
  await surface.evaluate(async (element) => {
    await Promise.all(
      element
        .getAnimations()
        .map((animation) => animation.finished.catch(() => undefined)),
    );
  });
}

async function watchExit(surface: Locator) {
  await surface.evaluate((element) => {
    const state = window as typeof window & { __exitDistance?: number };
    const top = element.getBoundingClientRect().top;
    state.__exitDistance = 0;
    const deadline = performance.now() + 1_200;
    const sample = () => {
      if (element.isConnected)
        state.__exitDistance = Math.max(
          state.__exitDistance ?? 0,
          element.getBoundingClientRect().top - top,
        );
      if (performance.now() < deadline) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

function exitDistance(page: Page) {
  return page.evaluate(
    () =>
      (window as typeof window & { __exitDistance?: number }).__exitDistance ??
      0,
  );
}

test("the issue composer opens over its feed and preserves back/forward history", async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, "ordinary");
  try {
    await page.goto("/issues");
    await page.waitForURL(/\/issues\/[^/]+$/u);
    const feed = await page
      .locator(".route-page")
      .getAttribute("data-route-path");
    await page.getByRole("link", { name: "New proposal" }).click();
    await page.waitForURL(/\/issues\/[^/]+\/compose\/new$/u);
    const composer = page.getByRole("dialog");
    await expect(
      composer.getByRole("textbox", { name: "Proposal title" }),
    ).toBeVisible();
    await expect(page.locator(".route-page")).toHaveAttribute(
      "data-route-path",
      feed!,
    );
    await composer.getByRole("button", { name: "Close" }).click();
    await page.waitForURL(/\/issues\/[^/]+$/u);
    await expect(composer).toHaveCount(0);
    await page.goForward();
    await expect(
      composer.getByRole("textbox", { name: "Proposal title" }),
    ).toBeVisible();
    await page.goBack();
    await expect(composer).toHaveCount(0);
    const destination = page.locator(
      '[data-primary-navigation]:visible a[href="/home"]',
    );
    await destination.dispatchEvent("pointerdown", {
      button: 0,
      pointerType: "mouse",
    });
    await expect(destination).not.toHaveAttribute("aria-current", "page");
    await destination.click();
    await page.waitForURL(/\/home$/u);
    await expect(destination).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".route-page")).toHaveAttribute(
      "data-route-direction",
      "none",
    );
  } finally {
    await context.close();
  }
});

test("a record stays over its source list until the native popup finishes closing", async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, "ordinary");
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/issues");
    const card = page.locator('.t-card a[href^="/issues/"]').first();
    await expect(card).toBeVisible();
    const feed = await page
      .locator(".route-page")
      .getAttribute("data-route-path");
    await card.click();
    const record = page.getByRole("dialog");
    await expect(record.locator("article h1")).toBeVisible();
    await expect(record).toBeInViewport({ ratio: 1 });
    await expect(page.locator("[data-sheet-surface]")).toHaveCount(1);
    await expect(page.locator(".route-page")).toHaveAttribute(
      "data-route-path",
      feed!,
    );
    await settle(record);
    await watchExit(record);
    await record.getByRole("button", { name: "Close" }).click();
    await expect(record).toHaveAttribute("data-state", "closing");
    await expect(record).toHaveCount(0);
    await expect.poll(() => exitDistance(page)).toBeGreaterThan(120);
    await expect(card).toBeVisible();
  } finally {
    await context.close();
  }
});

test("an optimistic record popup appears before its intercepted route arrives", async ({
  browser,
}) => {
  const context = await browser.newContext({
    serviceWorkers: "block",
    storageState: authStatePath("ordinary"),
  });
  const page = await context.newPage();
  let releaseRoute = () => {};
  const held = new Promise<void>((resolve) => {
    releaseRoute = resolve;
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/issues");
    const card = page.locator('.t-card a[href^="/issues/"]').first();
    await expect(card).toBeVisible();
    const href = await card.getAttribute("href");
    let routeStarted = false;
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (
        url.pathname === href &&
        (url.searchParams.has("_rsc") || route.request().headers().rsc === "1")
      ) {
        routeStarted = true;
        await held;
      }
      await route.continue();
    });
    await card.click();
    await expect.poll(() => routeStarted).toBe(true);
    await expect(page.locator("[data-sheet-surface]")).toHaveCount(1);
    await expect(page.locator("[data-sheet-surface]")).toBeInViewport({
      ratio: 1,
    });
    releaseRoute();
    await expect(page.getByRole("dialog").locator("article h1")).toBeVisible();
    await expect(page.locator("[data-sheet-surface]")).toHaveCount(1);
  } finally {
    releaseRoute();
    await context.close();
  }
});

test("a cancelled header drag returns the popup to its original position", async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, "ordinary");
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/issues");
    await page.locator('.t-card a[href^="/issues/"]').first().click();
    const popup = page.getByRole("dialog");
    await expect(popup.locator("article h1")).toBeVisible();
    await settle(popup);
    const before = await popup.boundingBox();
    const header = await popup
      .locator("[data-sheet-drag-region]")
      .first()
      .boundingBox();
    const x = header!.x + header!.width / 2;
    const y = header!.y + header!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(120);
    await page.mouse.move(x, y + 36, { steps: 4 });
    await page.waitForTimeout(120);
    await page.mouse.up();
    await expect(popup).toHaveAttribute("data-state", "open");
    await expect
      .poll(async () => (await popup.boundingBox())!.y)
      .toBeCloseTo(before!.y, 1);
    await expect(popup).toBeInViewport({ ratio: 1 });
  } finally {
    await context.close();
  }
});

test("selection and action sheets cancel back to the same record", async ({
  browser,
}) => {
  const { context, page } = await newUserPage(browser, "admin");
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/issues");
    await page.locator('.t-card a[href^="/issues/"]').first().click();
    const detail = page.locator("[data-sheet-surface]");
    const title = detail.locator("article h1");
    await expect(title).toBeVisible();
    const initialTitle = await title.innerText();
    const sort = detail.getByRole("combobox", {
      name: "Comment order",
      exact: true,
    });
    await sort.click();
    await expect(page.locator(".sheet-modal")).toBeInViewport({ ratio: 1 });
    await page
      .getByRole("radio", { name: "Oldest first", exact: true }).press('Space');
    await expect(sort).toContainText("Oldest first");
    await detail
      .getByRole("button", { name: "More actions", exact: true })
      .click();
    const actions = page.locator(".actions-modal");
    await expect(actions).toBeInViewport({ ratio: 1 });
    await expect(page.locator("[data-sheet-surface]")).toHaveCount(1);
    await actions.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(actions).toHaveCount(0);
    await expect(title).toHaveText(initialTitle);
    await expect(detail).toBeInViewport({ ratio: 1 });
  } finally {
    await context.close();
  }
});

for (const width of [390, 1280]) {
  test(`controlled admin popups retain their surface through native departure (${width}px)`, async ({
    browser,
  }) => {
    const { context, page } = await newUserPage(browser, "admin");
    try {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/people?view=restrictions");
      await page
        .getByRole("button", { name: /Add prefix rule|新增前綴規則/u })
        .click();
      const popup = page.locator("[data-sheet-surface]");
      await expect(popup).toBeInViewport({ ratio: 1 });
      await settle(popup);
      await watchExit(popup);
      await popup.getByRole("button", { name: /Close|關閉/u }).click();
      await expect(popup).toHaveAttribute("data-state", "closing");
      await expect(popup).toHaveCount(0);
      await expect.poll(() => exitDistance(page)).toBeGreaterThan(120);
    } finally {
      await context.close();
    }
  });
}

test("reduced motion opens and closes controls without movement", async ({
  browser,
}) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    storageState: authStatePath("ordinary"),
  });
  const page = await context.newPage();
  try {
    await page.goto("/announcements");
    await page.getByRole("combobox").first().click();
    const popover = page.locator(".popover");
    await expect(popover).toBeVisible();
    expect(
      await popover.evaluate(
        (element) =>
          element
            .getAnimations()
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);
    await page.keyboard.press("Escape");
    await expect(popover).toHaveCount(0);
  } finally {
    await context.close();
  }
});
