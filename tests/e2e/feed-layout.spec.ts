import { readFile } from 'node:fs/promises';
import { expect, test, type BrowserContext, type Locator } from '@playwright/test';
import { authStatePath } from './support/paths';
import { actionStreamBody, readActionStream } from './support/backend-action';

async function geometry(card: Locator) {
  return card.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const header = element.querySelector('[data-slot="feed-card-header"]')!.getBoundingClientRect();
    const footer = element.querySelector('[data-slot="feed-card-footer"]')!.getBoundingClientRect();
    return { width: rect.width, height: rect.height, header: header.height, footer: footer.top - rect.top };
  });
}

test('long feed content stays inside cards at small phone and desktop widths', async ({ browser }) => {
  test.setTimeout(180_000);
  const state: Awaited<ReturnType<BrowserContext['storageState']>> = JSON.parse(await readFile(authStatePath('ordinary'), 'utf8'));
  for (const origin of state.origins) {
    origin.indexedDB = origin.indexedDB?.filter((database) => database.name.startsWith('firebase'));
  }
  const context = await browser.newContext({ storageState: state, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const title = 'W'.repeat(30);
  const author = 'LongAuthorNameWithoutSpaces'.repeat(3);
  const feeds = [
    { route: '/issues/proposal-a', action: 'listIssues', key: 'issues' },
    { route: '/facilities?category=facility-a', action: 'listFacilities', key: 'facilities' },
    { route: '/announcements', action: 'listAnnouncements', key: 'announcements' },
  ];
  await page.route('**/v1/actions', async (route) => {
    const action = route.request().postDataJSON()?.action;
    const feed = feeds.find((item) => item.action === action);
    if (!feed && action !== 'getUserPublicProfiles') return route.continue();
    const response = await route.fetch();
    const answer = readActionStream(await response.text());
    if (feed) {
      answer.data[feed.key] = (answer.data[feed.key] as Record<string, unknown>[]).map((item) => ({
        ...item, title, location: 'LongLocationWithoutSpaces'.repeat(3),
        supportCount: 12345, affectedCount: 12345, likeCount: 12345, commentCount: 12345,
      }));
    } else {
      answer.data.profiles = Object.fromEntries(Object.entries(answer.data.profiles as Record<string, Record<string, unknown>>)
        .map(([uid, profile]) => [uid, { ...profile, displayName: author }]));
    }
    await route.fulfill({ body: actionStreamBody(answer), contentType: 'application/x-ndjson', status: 200 });
  });
  try {
    for (const width of [320, 360, 375, 384, 412, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const feed of feeds) {
        await page.goto(feed.route);
        const cards = page.locator('.t-card');
        await expect(cards.first().getByRole('heading', { name: title })).toBeVisible();
        await expect(cards.first().getByText(author, { exact: true })).toBeVisible();
        const overflow = await page.evaluate(() => ({
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          cards: Array.from(document.querySelectorAll('.t-card'), (card) => {
            const box = card.getBoundingClientRect();
            return Math.max(card.scrollWidth - card.clientWidth, box.right - innerWidth, -box.left);
          }),
        }));
        expect(overflow.page, `${feed.route} at ${width}px`).toBeLessThanOrEqual(1);
        for (const amount of overflow.cards) expect(amount, `card at ${width}px`).toBeLessThanOrEqual(1);
      }
    }
  } finally { await context.close(); }
});

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
  test(`feed placeholders reserve the loaded geometry at ${viewport.width}px`, async ({ browser }) => {
    const state: Awaited<ReturnType<BrowserContext['storageState']>> = JSON.parse(await readFile(authStatePath('ordinary'), 'utf8'));
    // Preserve real authentication, but require a cold content read for this check.
    for (const origin of state.origins) {
      origin.indexedDB = origin.indexedDB?.filter((database) => database.name.startsWith('firebase'));
    }
    const context = await browser.newContext({ storageState: state, viewport, reducedMotion: 'reduce' });
    let release = () => {};
    let requested = false;
    const hold = new Promise<void>((resolve) => { release = resolve; });
    const page = await context.newPage();
    await page.route('**/v1/actions', async (route) => {
      if (route.request().postDataJSON()?.action === 'listIssues') { requested = true; await hold; }
      await route.continue();
    });
    try {
      await page.goto('/issues/proposal-a');
      await expect.poll(() => requested).toBe(true);
      const pending = page.locator('.route-card-skeleton').first();
      await expect(pending).toBeVisible();
      const before = await geometry(pending);
      const frame = await pending.elementHandle();
      release();
      const loaded = page.locator('.t-card').first();
      await expect(loaded).toBeVisible();
      const after = await geometry(loaded);
      expect(await frame!.evaluate((element) => element === document.querySelector('[data-feed-slot="0"]'))).toBe(true);
      for (const key of ['width', 'height', 'header', 'footer'] as const) {
        expect(Math.abs(before[key] - after[key]), key).toBeLessThanOrEqual(2);
      }
      expect(after.height).toBeLessThanOrEqual(220);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      // The field lives behind its own control at every width; the row only ever
      // shows the trigger.
      await expect(page.getByRole('textbox', { name: /Search titles/u })).toHaveCount(0);
      const search = page.getByRole('button', { name: /Search titles/u }).last();
      await expect(search).toBeVisible();
      await search.click();
      await expect(page.getByRole('textbox', { name: /Search titles/u })).toBeVisible();
      await page.keyboard.press('Escape');
      const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
      await navigation.filter({ visible: true }).getByRole('link', { name: 'Home', exact: true }).click();
      await expect(page).toHaveURL(/\/home$/u);
      await expect(page.locator('.route-page')).toHaveCount(1);
    } finally {
      release();
      await context.close();
    }
  });
}
