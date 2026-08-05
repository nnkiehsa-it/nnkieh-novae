import { expect, test, type Page } from '@playwright/test';
import { newUserPage } from './support/session';

async function createCategory(
  page: Page,
  kind: 'facility' | 'issue',
  label: string,
  id: string,
) {
  await page.getByRole('button', { name: 'Add category' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Category name' }).fill(label);
  await dialog.getByRole('textbox', { name: 'Category ID' }).fill(id);
  await dialog.getByRole('button', { name: 'Next' }).click();
  if (kind === 'issue') {
    await dialog.getByRole('button', { name: 'Next' }).click();
    await dialog.getByRole('button', { name: 'Next' }).click();
  }
  await dialog.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: label })).toBeVisible();
}

async function saveCategories(page: Page) {
  await page.getByRole('button', { name: 'Save all changes' }).click();
  await expect(page.getByRole('button', { name: 'Save all changes' })).toBeEnabled();
}

async function deleteSelectedCategory(page: Page) {
  await page.getByRole('button', { name: 'Delete category' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete', exact: true }).click();
}

test('proposal and facility categories create, rename, surface, and delete atomically', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto('/admin/management?tab=categories');

  await createCategory(
    admin.page,
    'issue',
    'E2E Temporary Proposal',
    'e2e-temp-proposal',
  );
  await saveCategories(admin.page);

  let ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/issues/proposal-a');
  await ordinary.page.getByRole('button', { name: 'Choose proposal category' }).click();
  await expect(ordinary.page.getByRole('button', { name: 'E2E Temporary Proposal' }))
    .toBeVisible();
  await ordinary.context.close();

  await admin.page.goto('/admin/management?tab=categories');
  await admin.page.getByRole('listitem').filter({ hasText: 'E2E Temporary Proposal' }).click();
  await admin.page.getByRole('textbox', { name: 'Category name' })
    .fill('E2E Renamed Proposal');
  await saveCategories(admin.page);

  ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/issues/proposal-a');
  await ordinary.page.getByRole('button', { name: 'Choose proposal category' }).click();
  await expect(ordinary.page.getByRole('button', { name: 'E2E Renamed Proposal' })).toBeVisible();
  await expect(ordinary.page.getByRole('button', { name: 'E2E Temporary Proposal' })).toHaveCount(0);
  await ordinary.context.close();

  await admin.page.goto('/admin/management?tab=categories');
  await admin.page.getByRole('listitem').filter({ hasText: 'E2E Renamed Proposal' }).click();
  await deleteSelectedCategory(admin.page);
  await saveCategories(admin.page);

  await admin.page.getByRole('button', { name: 'Facilities', exact: true }).click();
  await createCategory(
    admin.page,
    'facility',
    'E2E Temporary Facility',
    'e2e-temp-facility',
  );
  await saveCategories(admin.page);

  ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/facilities');
  await ordinary.page.getByRole('button', { name: 'Choose a facility-report category' }).click();
  await expect(ordinary.page.getByRole('button', { name: 'E2E Temporary Facility' })).toBeVisible();
  await ordinary.context.close();

  await admin.page.goto('/admin/management?tab=categories');
  await admin.page.getByRole('button', { name: 'Facilities', exact: true }).click();
  await admin.page.getByRole('listitem').filter({ hasText: 'E2E Temporary Facility' }).click();
  await deleteSelectedCategory(admin.page);
  await saveCategories(admin.page);

  ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/facilities');
  await ordinary.page.getByRole('button', { name: 'Choose a facility-report category' }).click();
  await expect(ordinary.page.getByRole('button', { name: 'E2E Temporary Facility' })).toHaveCount(0);
  await ordinary.context.close();
  await admin.context.close();
});
