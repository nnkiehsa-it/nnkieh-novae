import { expect, type Page } from '@playwright/test';

/** Opens one section of an administration area through its tab rail. */
export async function selectAdminSection(page: Page, label: string) {
  const tab = page.getByRole('main').getByRole('tab', { name: label, exact: true });
  await expect(tab).toBeVisible();
  if ((await tab.getAttribute('aria-selected')) !== 'true') await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
}
