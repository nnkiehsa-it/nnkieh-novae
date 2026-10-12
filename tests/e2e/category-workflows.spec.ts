import { expect, test, type Page } from '@playwright/test';
import { newUserPage } from './support/session';
import { expectBackendAction } from './support/backend-action';
import { selectAdminSection } from './pages/admin-page';

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
  await selectAdminSection(page, kind === 'issue' ? 'Proposals' : 'Facilities');
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
  await admin.page.goto('/admin/content?view=issue');

  await createCategory(
    admin.page,
    'issue',
    'E2E Temporary Proposal',
    'e2e-temp-proposal',
  );
  const images = await openCategory(admin.page, 'E2E Temporary Proposal');
  await images.getByRole('switch', { name: 'Allow images in posts' }).click();
  await images.getByRole('spinbutton', { name: 'Images per comment' }).fill('3');
  await closeCategory(admin.page);
  await saveCategories(admin.page);

  let ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/issues/proposal-a');
  await ordinary.page.getByRole('combobox').first().click();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Temporary Proposal' }))
    .toBeVisible();
  await ordinary.context.close();

  ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/issues/e2e-temp-proposal/compose/new');
  await expect(ordinary.page.getByRole('textbox', { name: 'Proposal title' })).toBeVisible();
  await expect(ordinary.page.getByRole('button', { name: 'Add image', exact: true })).toHaveCount(0);
  await ordinary.context.close();

  await admin.page.goto('/admin/content?view=issue');
  const renaming = await openCategory(admin.page, 'E2E Temporary Proposal');
  await expect(renaming.getByRole('combobox')).toBeDisabled();
  await expect(renaming.getByRole('switch', { name: 'Show author' })).toBeDisabled();
  await expect(renaming.getByRole('switch', { name: 'Allow images in posts' })).not.toBeChecked();
  await expect(renaming.getByRole('spinbutton', { name: 'Images per comment' })).toHaveValue('3');
  await renaming.getByRole('textbox', { name: 'Name', exact: true }).fill('E2E Renamed Proposal');
  await closeCategory(admin.page);
  await saveCategories(admin.page);

  ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/issues/proposal-a');
  await ordinary.page.getByRole('combobox').first().click();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Renamed Proposal' })).toBeVisible();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Temporary Proposal' })).toHaveCount(0);
  await ordinary.context.close();

  await admin.page.goto('/admin/content?view=issue');
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
  await selectAdminSection(admin.page, 'Facilities');
  await deleteCategory(admin.page, 'E2E Temporary Facility');
  await saveCategories(admin.page);

  ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/facilities');
  await ordinary.page.getByRole('combobox').first().click();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Temporary Facility' })).toHaveCount(0);
  await ordinary.context.close();
  await admin.context.close();
});
