import { expect, type Page } from '@playwright/test';

async function fillActiveCategory(page: Page, label: string, id: string) {
  await page.getByRole('textbox', { name: 'Category name' }).last().fill(label);
  await page.getByRole('textbox', { name: 'Identifier' }).last().fill(id);
}

async function addSetupCategory(
  page: Page,
  label: string,
  id: string,
) {
  await page.getByRole('button', { name: 'Add category' }).click();
  await fillActiveCategory(page, label, id);
}

export async function completeInitialSetup(page: Page) {
  await expect(page).toHaveURL(/\/setup$/u);
  await page.getByRole('button', { name: 'Continue' }).click();

  await fillActiveCategory(page, 'Proposal A', 'proposal-a');
  await addSetupCategory(page, 'Proposal B', 'proposal-b');

  await page.getByRole('tab', { name: 'Facility category' }).click();
  await fillActiveCategory(page, 'Facility A', 'facility-a');
  await addSetupCategory(page, 'Facility B', 'facility-b');

  const complete = page.getByRole('button', { name: 'Finish setup' });
  await expect(complete).toBeEnabled();
  await complete.click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm setup' }).click();
  await expect(page).toHaveURL(/\/issues\/proposal-a/u, { timeout: 20_000 });
}
