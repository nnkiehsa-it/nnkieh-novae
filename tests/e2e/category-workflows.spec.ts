import { expect, test, type Page } from '@playwright/test';
import { newUserPage } from './support/session';
import { expectBackendAction } from './support/backend-action';

/** A category is a row; its decisions open in a sheet of their own. */
async function openCategory(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  return sheet;
}

async function closeCategory(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function createCategory(
  page: Page,
  kind: 'facility' | 'issue',
  label: string,
  id: string,
) {
  await page.getByRole('tab', {
    name: kind === 'issue' ? 'Proposals' : 'Facilities',
  }).click();
  await page.getByRole('button', {
    name: kind === 'issue' ? 'Add proposal category' : 'Add facility category',
  }).click();
  const placeholder =
    kind === 'issue' ? /^Proposal category \d+$/u : /^Facility category \d+$/u;
  await page.getByRole('button', { name: placeholder }).last().click();
  const sheet = page.getByRole('dialog');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('textbox', { name: 'Name', exact: true }).fill(label);
  await sheet.getByRole('textbox', { name: 'Identifier' }).fill(id);
  await closeCategory(page);
  await expect(page.getByRole('button', { name: label, exact: true })).toBeVisible();
}

async function saveCategories(page: Page) {
  await expect(page.getByText('unsaved changes')).toBeVisible();
  await expectBackendAction(page, 'saveCategoryManagement', async () => {
    await page.getByRole('button', { name: 'Save', exact: true }).click();
  });
  await expect(page.getByText('unsaved changes')).toHaveCount(0);
}

async function deleteCategory(page: Page, label: string) {
  const sheet = await openCategory(page, label);
  await sheet.getByRole('button', { name: 'Delete category' }).click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Confirm delete' })
    .click();
  await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(0);
}

test('proposal and facility categories create, rename, surface, and delete atomically', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto('/admin/content');

  await createCategory(
    admin.page,
    'issue',
    'E2E Temporary Proposal',
    'e2e-temp-proposal',
  );
  await saveCategories(admin.page);

  let ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/issues/proposal-a');
  await ordinary.page.getByRole('combobox').first().click();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Temporary Proposal' }))
    .toBeVisible();
  await ordinary.context.close();

  await admin.page.goto('/admin/content');
  const renaming = await openCategory(admin.page, 'E2E Temporary Proposal');
  await renaming.getByRole('textbox', { name: 'Name', exact: true }).fill('E2E Renamed Proposal');
  await closeCategory(admin.page);
  await saveCategories(admin.page);

  ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/issues/proposal-a');
  await ordinary.page.getByRole('combobox').first().click();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Renamed Proposal' })).toBeVisible();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Temporary Proposal' })).toHaveCount(0);
  await ordinary.context.close();

  await admin.page.goto('/admin/content');
  await deleteCategory(admin.page, 'E2E Renamed Proposal');
  await saveCategories(admin.page);

  await createCategory(
    admin.page,
    'facility',
    'E2E Temporary Facility',
    'e2e-temp-facility',
  );
  await saveCategories(admin.page);

  ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/facilities');
  await ordinary.page.getByRole('combobox').first().click();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Temporary Facility' })).toBeVisible();
  await ordinary.context.close();

  await admin.page.goto('/admin/content');
  await admin.page.getByRole('tab', { name: 'Facilities' }).click();
  await deleteCategory(admin.page, 'E2E Temporary Facility');
  await saveCategories(admin.page);

  ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/facilities');
  await ordinary.page.getByRole('combobox').first().click();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Temporary Facility' })).toHaveCount(0);
  await ordinary.context.close();
  await admin.context.close();
});
