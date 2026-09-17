import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { actionStreamBody } from "./support/backend-action";
import { readContentState } from "./support/content-state";
import { authStatePath } from "./support/paths";

const kinds = ["proposalA", "facilityA", "announcement"] as const;

for (const width of [390, 1440]) {
  for (const kind of kinds) {
    test(`${kind} notification retains its source and closes through history at ${width}px`, async ({ browser }) => {
      // Network fixtures must be owned by Playwright rather than the PWA worker.
      // Direct-entry and header cases below still use normal service workers.
      const context = await browser.newContext({ serviceWorkers: "block", storageState: authStatePath("admin"), viewport: { width, height: 844 } });
      const page = await context.newPage();
      const content = await readContentState();
      const pathname = new URL(content[kind]).pathname;
      // Seed only the notification read model; the target records, route
      // transitions, session and history all run against the real application.
      await page.route("**/v1/actions", async (route) => {
        if (route.request().postDataJSON()?.action !== "getNotificationSnapshot") return route.continue();
        const targetType = kind === "proposalA" ? "issue" : kind === "facilityA" ? "facility" : "announcement";
        const pages = { broadcast: { cursor: null, hasMore: false, notifications: Array.from({ length: 24 }, (_, index) => ({
            id: randomUUID(),
            type: kind === "facilityA" ? "facility_report_created" : `${targetType}_created`,
            targetType,
            targetId: index === 23 ? pathname.split("/").at(-1) : randomUUID(),
            issueCategory: kind === "proposalA" ? "proposal-a" : null,
            title: `E2E ${kind} notification ${index + 1}`,
            createdAt: new Date(Date.now() - index * 1_000).toISOString(),
          })) } };
        await route.fulfill({ status: 200, contentType: "application/x-ndjson", body: [
          { type: "start", operationId: randomUUID(), policyRevision: 0 },
          { type: "part", key: "pages", data: pages },
          { type: "part", key: "state", data: {} },
          { type: "part", key: "openedAt", data: new Date().toISOString() },
          { type: "end" },
        ].map((part) => JSON.stringify(part)).join("\n") });
      });
      try {
        await page.goto("/notifications");
        const source = page.locator(".route-page");
        await expect(page.locator("[data-notification-surface]")).toHaveAttribute("aria-busy", "false");
        await expect(page.locator('[data-notification-surface] [data-resizing="true"]')).toHaveCount(0);
        const link = source.locator(`a[href="${pathname}"]`).first();
        await expect(link).toBeVisible();
        await link.scrollIntoViewIfNeeded();
        const target = await link.boundingBox();
        expect(target).not.toBeNull();
        const sourceNode = await source.elementHandle();
        const scroll = await page.evaluate(() => scrollY);
        expect(scroll, "exercise restoration after scrolling beyond the first screen").toBeGreaterThan(0);
        await page.mouse.click(target!.x + target!.width / 2, target!.y + target!.height / 2);
        const record = page.getByRole("dialog");
        await expect(record).toHaveCount(1);
        await expect(record.locator("article h1")).toContainText("E2E");
        await expect(source).toHaveAttribute("data-route-path", "/notifications");
        expect(await sourceNode!.evaluate((node) => node === document.querySelector(".route-page"))).toBe(true);
        await record.locator(".detail-header").getByRole("button", { name: "Close", exact: true }).click();
        await expect(page).toHaveURL(/\/notifications$/u);
        await expect(page.locator("[data-sheet-surface]")).toHaveCount(0);
        await expect.poll(() => page.evaluate((expected) => Math.abs(scrollY - expected), scroll)).toBeLessThanOrEqual(1);
        await page.goForward();
        await expect(record.locator("article h1")).toContainText("E2E");
        await page.goBack();
        await expect(page).toHaveURL(/\/notifications$/u);
        await expect(page.locator("[data-sheet-surface]")).toHaveCount(0);
      } finally { await context.close(); }
    });
  }

  test(`direct records and reloads share the sheet and return to their own feed at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: authStatePath("admin"), viewport: { width, height: 844 } });
    const page = await context.newPage();
    const content = await readContentState();
    try {
      for (const kind of kinds) {
        const path = new URL(content[kind]).pathname;
        await page.goto("/settings");
        await page.goto(content[kind]);
        await expect(page.getByRole("dialog").locator("article h1")).toContainText("E2E");
        await page.reload();
        const record = page.getByRole("dialog");
        await expect(record).toHaveCount(1);
        await expect(record.locator("article h1")).toContainText("E2E");
        await record.locator(".detail-header").getByRole("button", { name: "Close", exact: true }).click();
        await expect.poll(() => new URL(page.url()).pathname).toBe(path.slice(0, path.lastIndexOf("/")));
        await expect(page.locator("[data-sheet-surface]")).toHaveCount(0);
      }
    } finally { await context.close(); }
  });

  test(`long supporters sheets reach their final row without scroll chaining at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ serviceWorkers: "block", storageState: authStatePath("admin"), viewport: { width, height: 620 } });
    const page = await context.newPage();
    await page.route("**/v1/actions", async (route) => {
      if (route.request().postDataJSON()?.action !== "listIssueSupporters") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body: actionStreamBody({
          operationId: randomUUID(),
          data: { supporters: Array.from({ length: 120 }, (_, index) => ({
            uid: `surface-supporter-${index}`,
            displayName: `Fixture Supporter ${index + 1}`,
            photoUrl: null,
            isAuthor: index === 0,
          })) },
        }),
      });
    });
    try {
      await page.goto((await readContentState()).proposalA);
      await page.getByRole("dialog").getByRole("button", { name: /^Supporters/u }).click();
      const sheet = page.getByRole("dialog", { name: "Supporters", exact: true });
      const body = sheet.locator('[data-slot="sheet-body"]');
      const last = body.getByText("Fixture Supporter 120", { exact: true });
      await expect(last).toBeAttached();
      expect(await body.evaluate((node) =>
        !CSS.supports("overscroll-behavior", "none")
        || getComputedStyle(node).overscrollBehaviorY === "none"
      )).toBe(true);
      const size = await body.evaluate((node) => ({ client: node.clientHeight, scroll: node.scrollHeight }));
      expect(size.client).toBeGreaterThan(0);
      expect(size.scroll).toBeGreaterThan(size.client);
      await body.hover();
      await page.mouse.wheel(0, 100_000);
      await expect(last).toBeInViewport({ ratio: 1 });
      await expect.poll(() => body.evaluate((node) => node.scrollHeight - node.scrollTop - node.clientHeight)).toBeLessThanOrEqual(1);
      const positions = await page.evaluate(() => ({
        page: scrollY,
        record: document.querySelector('[data-slot="sheet-body"]')!.scrollTop,
      }));
      await page.mouse.wheel(0, 4_000);
      await expect(last).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => ({
        page: scrollY,
        record: document.querySelector('[data-slot="sheet-body"]')!.scrollTop,
      }))).toEqual(positions);
      await expect(sheet.getByRole("button", { name: "Close", exact: true })).toBeInViewport();
      await sheet.getByRole("button", { name: "Close", exact: true }).click();
      await expect(page.locator("[data-sheet-surface]")).toHaveCount(1);
    } finally { await context.close(); }
  });

  test(`header blur covers the complete title without filtering foreground at ${width}px`, async ({ browser }) => {
    const context = await browser.newContext({ storageState: authStatePath("admin"), viewport: { width, height: 844 } });
    const page = await context.newPage();
    try {
      for (const path of ["/admin", "/admin/platform", "/admin/people", "/settings"]) {
        await page.goto(path);
        const header = page.locator(".page-header");
        const title = header.locator("h1");
        const backdrop = header.locator('[data-slot="header-backdrop"]');
        await expect(title).toBeVisible();
        await expect(backdrop).toHaveCSS("backdrop-filter", "blur(12px)");
        await expect(backdrop).toHaveCSS("z-index", "0");
        await expect(backdrop).toHaveCSS("pointer-events", "none");
        await expect.poll(() => backdrop.evaluate((node) => {
          const veil = node.getBoundingClientRect();
          const viewport = document.querySelector(".app-main-column")!.getBoundingClientRect();
          return {
            left: Math.round(veil.left - viewport.left),
            right: Math.round(veil.right - viewport.right),
          };
        })).toEqual({ left: 0, right: 0 });
        await page.evaluate(() => window.scrollTo(10_000, scrollY));
        expect(await page.evaluate(() => ({
          extent: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          position: scrollX,
        }))).toEqual({ extent: 0, position: 0 });
        const geometry = await header.evaluate((node) => {
          const veil = node.querySelector<HTMLElement>('[data-slot="header-backdrop"]')!;
          const heading = node.querySelector("h1")!;
          const v = veil.getBoundingClientRect();
          const h = heading.getBoundingClientRect();
          const filters: string[] = [];
          for (let current: Element | null = heading; current; current = current.parentElement) {
            filters.push(getComputedStyle(current).filter);
            if (current === node) break;
          }
          return { veilTop: v.top, titleTop: h.top, solidBottom: v.bottom - parseFloat(getComputedStyle(veil).getPropertyValue("--header-fade")) * parseFloat(getComputedStyle(document.documentElement).fontSize), titleBottom: h.bottom, filters };
        });
        expect(geometry.veilTop).toBeLessThanOrEqual(geometry.titleTop);
        expect(geometry.solidBottom).toBeGreaterThanOrEqual(geometry.titleBottom);
        expect(geometry.filters.every((value) => value === "none")).toBe(true);
        expect(await page.evaluate(() =>
          !CSS.supports("overscroll-behavior", "none")
          || [...document.querySelectorAll("*")].every((node) => {
            const style = getComputedStyle(node);
            return style.overscrollBehaviorX === "none" && style.overscrollBehaviorY === "none";
          })
        )).toBe(true);
      }
    } finally { await context.close(); }
  });
}

test("pending row feedback uses the full-width pressed surface, not an inset frame", async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: "block", storageState: authStatePath("admin") });
  const page = await context.newPage();
  let release = () => {};
  const hold = new Promise<void>((resolve) => { release = resolve; });
  try {
    await page.goto("/admin");
    const row = page.locator('.route-page a.t-row[href="/admin/people"]');
    await expect(row).toBeVisible();
    await page.route("**/admin/people?*", async (route) => { await hold; await route.continue(); });
    await row.click();
    await expect(row).toHaveAttribute("data-navigating", "true");
    const paint = await row.evaluate((node) => ({
      shadow: getComputedStyle(node).boxShadow,
      background: getComputedStyle(node).backgroundColor,
      row: getComputedStyle(node, "::before").backgroundColor,
      left: parseFloat(getComputedStyle(node, "::before").left),
      right: parseFloat(getComputedStyle(node, "::before").right),
    }));
    expect(paint.shadow).toBe("none");
    expect(paint.background).toBe("rgba(0, 0, 0, 0)");
    expect(paint.row).not.toBe("rgba(0, 0, 0, 0)");
    expect(paint.left).toBeLessThan(0);
    expect(paint.right).toBeLessThan(0);
  } finally { release(); await context.close(); }
});
