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

test("signing out during the native menu transition releases the login page", async ({ browser }) => {
  const context = await browser.newContext({
    storageState: authStatePath("admin"),
    viewport: { width: 1280, height: 720 },
  });
  const page = await context.newPage();
  try {
    await context.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.goto("/home");
    await page.getByRole("button", { name: "Account menu", exact: true }).click();
    await page.getByRole("menuitem", { name: /Sign out/u }).click();
    const login = page.locator(".login-screen-page > .login-screen-content");
    await expect(login).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in with Google", exact: true })).toBeEnabled();
    await expect(page.locator(".novae-root")).not.toHaveAttribute("inert");
    await expect(page.locator(".login-screen-title h1")).toHaveCSS("font-size", "28px");
    await expect(page.locator(".login-screen-page")).toHaveCSS("background-color", "rgb(255, 255, 255)");
  } finally {
    await context.close();
  }
});

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
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    try {
      await page.goto("/home");
      await expect(page.locator("html")).toHaveClass(/ios/u);
      await expect(
        page.locator("[data-primary-navigation]:visible"),
      ).toBeVisible();
      await capture(page, "home-light", width);

      const content = await readContentState();
      const issuePath = new URL(content.proposalA).pathname;
      await page.goto(issuePath.slice(0, issuePath.lastIndexOf("/")));
      await expect(page.locator(".t-card").first()).toBeVisible();
      await capture(page, "feed-light", width);
      const picker = page.getByRole("combobox").first();
      const selected = await picker.locator("select").inputValue();
      await picker.click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByRole("radio").first()).toBeAttached();
      await expect(
        page.locator(width === 390 ? ".sheet-modal" : ".popover"),
      ).toBeInViewport({ ratio: 1 });
      await capture(page, "picker", width);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(picker.locator("select")).toHaveValue(selected);
      await page.goto("/feed");
      await expect(page.getByRole("button", {name: "Search titles, content, or authors…", exact: true})).toBeEnabled();
      await page.getByRole("button", {name: "Search titles, content, or authors…", exact: true}).click();
      const search = page.locator(".navbar .searchbar");
      await search.locator("input").fill("E2E");
      await search.locator("input").press("Enter");
      await search.getByRole("button", {name: "Clear search", exact: true}).click();
      await expect(search.locator("input")).toHaveValue("");
      await search.getByRole("button", {name: "Cancel", exact: true}).click();
      await expect(search).not.toHaveClass(/searchbar-enabled/u);

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
      const navbar = page.locator(".native-navbar-host > .navbar-large");
      const scroller = page.locator(".novae-page-content");
      await scroller.evaluate((el) => { el.scrollTop = 400; });
      await expect(navbar).toHaveClass(/navbar-large-collapsed/u);
      await expect(navbar.locator(".title")).toHaveCSS("opacity", "1");
      const title = await navbar.locator(".title").boundingBox();
      const frame = await navbar.boundingBox();
      expect(Math.abs(title!.x + title!.width / 2 - frame!.x - frame!.width / 2)).toBeLessThan(2);
      await capture(page, "settings-collapsed", width);
      const mode = page.getByRole("combobox", { name: "Display mode" });
      await mode.click();
      const nativePicker = page.getByRole("dialog");
      await expect(nativePicker).toBeVisible();
      await nativePicker.getByRole("radio", { name: "Dark", exact: true }).press("Space");
      await expect(nativePicker).toHaveCount(0);
      // A new document must restore the saved theme into both UI systems.
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
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
