import { expect, type Page } from '@playwright/test';

export async function selectAdminSection(page: Page, label: string) {
  const back = page.getByRole('button', { name: 'Back to section summary', exact: true });
  if (await back.isVisible()) await back.click();
  await page.getByRole('main').getByRole('button').filter({ has: page.getByText(label, { exact: true }) }).click();
  await expect(page.getByRole('main').getByRole('heading', { level: 2, name: label, exact: true })).toBeVisible();
}
