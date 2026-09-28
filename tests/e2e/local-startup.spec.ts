import { expect, test } from '@playwright/test';

test('local auto-login survives refresh and route compilation without a startup loop', async ({ page }) => {
  test.skip(process.env.NEXT_PUBLIC_LOCAL_DEV_AUTH !== 'true', 'Uses test:env with automatic local sign-in.');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('novae:locale', 'en');
    sessionStorage.setItem('novae:app-install-prompt-dismissed', '1');
  });
  await page.goto('/issues');
  const settings = page.getByRole('link', { name: 'Settings', exact: true }).filter({ visible: true });
  await expect(settings).toBeVisible();
  await settings.click();
  await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await page.reload();
    await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
    await expect(page.locator('.app-start-surface')).toHaveCount(0);
  }
  expect(errors).toEqual([]);
});
