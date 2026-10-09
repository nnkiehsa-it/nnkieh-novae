import { mkdir } from "node:fs/promises";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { readContentState } from "./support/content-state";
import { authStatePath } from "./support/paths";

const captureDirectory = path.resolve(".impeccable/review/framework7");

async function capture(page: Page, name: string, width: number) {
  await mkdir(captureDirectory, { recursive: true });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(captureDirectory, `${name}-${width}.png`),
  });
}

for (const width of [390, 1440]) {
  test(`iOS controls preserve selection, cancellation and dark mode at ${width}px`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      storageState: authStatePath("admin"),
      viewport: { width, height: 844 },
      reducedMotion: "reduce",
    });
    await context.addInitScript(() => {
      if (!localStorage.getItem("theme"))
        localStorage.setItem("theme", "light");
    });
    const page = await context.newPage();
    try {
      await page.goto("/home");
      await expect(page.locator("html")).toHaveClass(/ios/u);
      await expect(
        page.locator("[data-primary-navigation]:visible"),
      ).toBeVisible();
      await capture(page, "home-light", width);

      await page.goto("/issues/proposal-a");
      await expect(page.locator(".t-card").first()).toBeVisible();
      await capture(page, "feed-light", width);
      const picker = page.getByRole("combobox").first();
      const selected = await picker.innerText();
      await picker.click();
      await expect(page.getByRole("listbox")).toBeVisible();
      await expect(
        page.locator(width === 390 ? ".sheet-modal" : ".popover"),
      ).toBeInViewport({ ratio: 1 });
      await capture(page, "picker", width);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("listbox")).toHaveCount(0);
      await expect(picker).toHaveText(selected);

      await page.goto((await readContentState()).proposalA);
      await expect(
        page.getByRole("dialog").locator("article h1"),
      ).toContainText("E2E");
      await expect(page.locator(".popup")).toBeInViewport({ ratio: 1 });
      await capture(page, "record", width);
      await page
        .getByRole("button", { name: "More actions", exact: true })
        .click();
      const menu = page.locator(width === 390 ? ".actions-modal" : ".popover");
      await expect(menu).toBeVisible();
      await expect(menu).toBeInViewport({ ratio: 1 });
      await capture(page, "actions", width);
      await menu.getByText("Delete proposal", { exact: true }).click();
      const confirmation = page.getByRole("alertdialog");
      await expect(confirmation).toBeVisible();
      await expect(confirmation).toBeInViewport({ ratio: 1 });
      await capture(page, "alert", width);
      await confirmation
        .getByRole("button", { name: "Cancel", exact: true })
        .click();
      await expect(confirmation).toHaveCount(0);
      await expect(
        page.getByRole("dialog").locator("article h1"),
      ).toContainText("E2E");

      await page.goto("/settings");
      await expect(page.locator(".route-page")).toHaveAttribute(
        "data-route-path",
        "/settings",
      );
      await capture(page, "settings-light", width);
      // A new document must restore the saved theme into both UI systems.
      await page.evaluate(() => localStorage.setItem("theme", "dark"));
      await page.reload();
      await expect(page.locator("html")).toHaveClass(/dark/u);
      await expect(page.locator(".route-page")).toBeVisible();
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(0, 0, 0)",
      );
      await capture(page, "settings-dark", width);
      await page.goto("/admin");
      await expect(
        page.getByRole("heading", { name: "Administration", exact: true }),
      ).toBeVisible();
      await capture(page, "admin-dark", width);
    } finally {
      await context.close();
    }
  });
}
