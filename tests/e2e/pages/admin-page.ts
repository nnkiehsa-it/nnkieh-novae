import { expect, type Page } from '@playwright/test';

export async function selectAdminSection(page: Page, label: string) {
  const back = page.getByRole('button', { name: 'Back to section summary', exact: true });
  const summary = page.getByRole('group', { name: 'Section summary', exact: true });
  await expect(back.or(summary)).toBeVisible();
  const heading = page.getByRole('main').getByRole('heading', { level: 2, name: label, exact: true });
  if (await heading.isVisible()) return;
  if (await back.isVisible()) await back.click();
  await page.getByRole('main').getByRole('button').filter({ has: page.getByText(label, { exact: true }) }).click();
  await expect(heading).toBeVisible();
}
