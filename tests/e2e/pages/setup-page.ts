import { expect, type Page } from '@playwright/test';

async function fillActiveCategory(page: Page, label: string, id: string) {
  await page.getByRole('textbox', { name: 'Category name' }).fill(label);
  await page.getByRole('textbox', { name: 'Category ID' }).fill(id);
}

async function configureProposalWorkflow(page: Page) {
  await page.getByRole('button', { name: 'Workflow rules' }).click();
  await page.getByRole('button', { name: /Everyone at school/i }).click();
  await page.getByRole('button', { name: /Show author/i }).click();
  await page.getByRole('button', { name: 'Basic settings' }).click();
}

async function addSetupCategory(
  page: Page,
  label: string,
  id: string,
  proposal = false,
) {
  await page.getByRole('button', { name: 'Add category' }).click();
  await page.getByRole('listitem').filter({ hasText: 'Untitled category' }).click();
  await fillActiveCategory(page, label, id);
  if (proposal) await configureProposalWorkflow(page);
}

export async function completeInitialSetup(page: Page) {
  await expect(page).toHaveURL(/\/setup$/u);
  await page.getByRole('button', { name: 'Continue' }).click();

  await fillActiveCategory(page, 'Proposal A', 'proposal-a');
  await configureProposalWorkflow(page);
  await addSetupCategory(page, 'Proposal B', 'proposal-b', true);

  await page.getByRole('button', { name: 'Facility-report categories' }).click();
  await fillActiveCategory(page, 'Facility A', 'facility-a');
  await addSetupCategory(page, 'Facility B', 'facility-b');

  const complete = page.getByRole('button', { name: 'Complete setup' });
  await expect(complete).toBeEnabled();
  await complete.click();
  await page.getByRole('button', { name: 'Skip for now and finish setup' }).click();
  await expect(page).toHaveURL(/\/issues\/proposal-a/u, { timeout: 20_000 });
}
