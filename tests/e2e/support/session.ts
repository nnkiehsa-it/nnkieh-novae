import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { authStatePath } from './paths';

export async function newUserPage(
  browser: Browser,
  user: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ storageState: authStatePath(user) });
  const page = await context.newPage();
  return { context, page };
}

export async function expectDenied(page: Page) {
  await expect(
    page.getByText(/not permitted|permission|沒有權限|無權/u).first(),
  ).toBeVisible();
}
