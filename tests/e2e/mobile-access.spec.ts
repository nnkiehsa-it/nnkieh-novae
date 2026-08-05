import { expect, test, type Page } from '@playwright/test';
import { authStatePath } from './support/paths';
import { readContentState } from './support/content-state';

async function suppressInstallPrompt(page: Page) {
  await page.addInitScript(() => {
    sessionStorage.setItem('novae-app-install-prompt-dismissed', '1');
  });
}

test.describe('proposal manager on mobile', () => {
  test.use({ storageState: authStatePath('issueManager') });

  test('keeps category-scoped controls and mobile navigation in sync', async ({ page }) => {
    await suppressInstallPrompt(page);
    const content = await readContentState();
    await page.goto(content.proposalA);
    await expect(page.getByRole('banner').getByRole('button', { name: 'Back to proposals' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Change status or result' })).toBeVisible();
    await page.goto(content.proposalB);
    await expect(page.getByRole('button', { name: 'Change status or result' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete proposal' })).toHaveCount(0);
  });
});

test.describe('facility manager on mobile', () => {
  test.use({ storageState: authStatePath('facilityManager') });

  test('keeps facility scope identical to desktop', async ({ page }) => {
    await suppressInstallPrompt(page);
    const content = await readContentState();
    await page.goto(content.facilityA);
    await expect(page.getByRole('button', {
      name: /Start processing|Complete \/ Cannot resolve/,
    })).toBeVisible();
    await page.goto(content.facilityB);
    await expect(page.getByRole('button', {
      name: /Start processing|Complete \/ Cannot resolve/,
    })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Delete facility report' })).toHaveCount(0);
  });
});

test.describe('ordinary owner on mobile', () => {
  test.use({ storageState: authStatePath('ordinary') });

  test('retains owner-only destructive actions', async ({ page }) => {
    await suppressInstallPrompt(page);
    const content = await readContentState();
    await page.goto(content.proposalA);
    await expect(page.getByRole('button', { name: 'Delete proposal' })).toBeVisible();
    await page.goto(content.facilityB);
    await expect(page.getByRole('button', { name: 'Delete facility report' })).toBeVisible();
  });
});

test.describe('platform administrator on mobile', () => {
  test.use({ storageState: authStatePath('admin') });

  test('can reach protected management pages', async ({ page }) => {
    await suppressInstallPrompt(page);
    await page.goto('/admin/management');
    await expect(page.getByRole('main').getByRole('heading', { name: 'System settings' }))
      .toBeVisible();
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard/u);
  });
});
