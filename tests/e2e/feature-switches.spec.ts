import { expect, test, type Page } from '@playwright/test';
import { newUserPage } from './support/session';

async function setFeatureSwitches(
  page: Page,
  issuesEnabled: boolean,
  facilitiesEnabled: boolean,
) {
  await page.goto('/admin/management?tab=categories');
  const issues = page.getByRole('switch', { name: 'Proposal feature' });
  await expect(issues).toBeVisible();
  if (await issues.isChecked() !== issuesEnabled) await issues.click();

  await page.getByRole('tab', { name: 'Facilities' }).click();
  const facilities = page.getByRole('switch', { name: 'Facility reports' });
  await expect(facilities).toBeVisible();
  if (await facilities.isChecked() !== facilitiesEnabled) await facilities.click();

  const save = page.getByRole('button', { name: 'Save all changes' });
  await save.click();
  await expect(save.locator('[data-state="complete"]')).toBeVisible();
  await expect(save).toBeEnabled();
}

test('all four proposal and facility feature combinations update navigation and direct routes', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const admin = await newUserPage(browser, 'admin');
  const combinations = [
    { facilities: false, issues: false },
    { facilities: false, issues: true },
    { facilities: true, issues: false },
    { facilities: true, issues: true },
  ];

  try {
    for (const combination of combinations) {
      await setFeatureSwitches(admin.page, combination.issues, combination.facilities);
      const ordinary = await newUserPage(browser, 'ordinary');
      await ordinary.page.goto('/');
      await expect(ordinary.page.getByRole('link', { name: 'Proposals', exact: true }))
        .toHaveCount(combination.issues ? 1 : 0);
      await expect(ordinary.page.getByRole('link', { name: 'Facilities', exact: true }))
        .toHaveCount(combination.facilities ? 1 : 0);

      if (!combination.issues) {
        await ordinary.page.goto('/issues/proposal-a');
        await expect(ordinary.page).not.toHaveURL(/\/issues/u);
      }
      if (!combination.facilities) {
        await ordinary.page.goto('/facilities');
        await expect(ordinary.page).not.toHaveURL(/\/facilities/u);
      }
      await ordinary.context.close();
    }
  } finally {
    await setFeatureSwitches(admin.page, true, true);
    await admin.context.close();
  }
});
