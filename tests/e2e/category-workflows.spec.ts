import { expect, test, type Page } from '@playwright/test';
import { newUserPage } from './support/session';

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
  const editor = page
    .getByRole('group')
    .filter({ has: page.getByRole('textbox', { name: 'Name' }) })
    .last();
  await editor.getByRole('textbox', { name: 'Name' }).fill(label);
  await editor.getByRole('textbox', { name: 'Identifier' }).fill(id);
  await expect(page.getByRole('group', { name: label })).toBeVisible();
}

async function saveCategories(page: Page) {
  const save = page.getByRole('button', { name: 'Save all changes' });
  await save.click();
  await expect(save.locator('[data-state="complete"]')).toBeVisible();
  await expect(save).toBeEnabled();
}

async function deleteCategory(page: Page, label: string) {
  await page
    .getByRole('group', { name: label })
    .getByRole('button', { name: 'Delete category' })
    .click();
  await page
    .getByRole('alertdialog')
    .getByRole('button', { name: 'Confirm delete' })
    .click();
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
  await ordinary.page.getByRole('combobox').first().click();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Temporary Proposal' }))
    .toBeVisible();
  await ordinary.context.close();

  await admin.page.goto('/admin/management?tab=categories');
  await admin.page
    .getByRole('group', { name: 'E2E Temporary Proposal' })
    .getByRole('textbox', { name: 'Name' })
    .fill('E2E Renamed Proposal');
  await saveCategories(admin.page);

  ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/issues/proposal-a');
  await ordinary.page.getByRole('combobox').first().click();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Renamed Proposal' })).toBeVisible();
  await expect(ordinary.page.getByRole('option', { name: 'E2E Temporary Proposal' })).toHaveCount(0);
  await ordinary.context.close();

  await admin.page.goto('/admin/management?tab=categories');
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

  await admin.page.goto('/admin/management?tab=categories');
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
