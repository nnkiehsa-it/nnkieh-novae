import { expect, test, type Page } from '@playwright/test';
import { newUserPage } from './support/session';
import { expectBackendAction } from './support/backend-action';

async function setFeatureSwitches(
  page: Page,
  issuesEnabled: boolean,
  facilitiesEnabled: boolean,
) {
  await page.goto('/admin/content');
  const issues = page.getByRole('switch', { name: 'Proposal feature' });
  await expect(issues).toBeVisible();
  const issuesChanged = await issues.isChecked() !== issuesEnabled;
  if (issuesChanged) await issues.click();

  await page.getByRole('tab', { name: 'Facilities' }).click();
  const facilities = page.getByRole('switch', { name: 'Facility reports' });
  await expect(facilities).toBeVisible();
  const facilitiesChanged = await facilities.isChecked() !== facilitiesEnabled;
  if (facilitiesChanged) await facilities.click();

  // There is nothing to save when the screen already reads the way it should,
  // and the save bar is absent exactly then.
  if (!issuesChanged && !facilitiesChanged) return;
  await expectBackendAction(page, 'saveCategoryManagement', async () => {
    await page.getByRole('button', { name: 'Save', exact: true }).click();
  });
  await expect(page.getByText('unsaved changes')).toHaveCount(0);
}

test('all four feature combinations update the guided home, feed tabs and direct routes', async ({
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
      await expect(ordinary.page).toHaveURL(/\/home$/u);
      const nav = ordinary.page.locator('[data-primary-navigation]:visible');
      await expect(nav.locator('a[href="/home"]')).toBeVisible();
      await expect(nav.locator('a[href="/feed"]')).toBeVisible();
      await expect(ordinary.page.locator('[data-dashboard-surface]')).toHaveCount(0);
      await expect(ordinary.page.getByRole('link', { name: 'Explore proposals', exact: true }))
        .toHaveCount(combination.issues ? 1 : 0);
      await expect(ordinary.page.getByRole('link', { name: /^Explore facility reports/u }))
        .toHaveCount(combination.facilities ? 1 : 0);
      await expect(ordinary.page.getByRole('link', { name: 'Share an idea', exact: true }))
        .toHaveCount(combination.issues ? 1 : 0);
      await expect(ordinary.page.getByRole('link', { name: 'Report a facility problem', exact: true }))
        .toHaveCount(!combination.issues && combination.facilities ? 1 : 0);
      await expect(ordinary.page.getByRole('link', { name: /^Read the latest announcements/u }))
        .toHaveAttribute('href', '/feed?view=announcements');

      await admin.page.goto('/home');
      await expect(admin.page.locator('[data-dashboard-surface]')).toHaveCount(0);
      const primaryLabel = combination.issues ? 'Explore proposals'
        : combination.facilities ? 'Explore facility reports' : 'Read the latest announcements';
      await expect(admin.page.getByRole('link', { name: primaryLabel, exact: true })).toBeVisible();

      await ordinary.page.goto('/feed');
      await expect(ordinary.page.getByRole('tab', { name: 'Proposals', exact: true }))
        .toHaveCount(combination.issues ? 1 : 0);
      await expect(ordinary.page.getByRole('tab', { name: 'Facilities', exact: true }))
        .toHaveCount(combination.facilities ? 1 : 0);
      await expect(ordinary.page.getByRole('tab', { name: 'Announcements', exact: true })).toBeVisible();
      await expect(ordinary.page.getByRole('tab', {
        name: combination.issues ? 'Proposals' : 'Announcements', exact: true,
      })).toHaveAttribute('aria-selected', 'true');

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
