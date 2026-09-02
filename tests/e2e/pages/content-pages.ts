import { expect, type Page } from '@playwright/test';
import { expectBackendAction } from '../support/backend-action';

export async function chooseMoreAction(page: Page, name: string | RegExp) {
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('menuitem', { name }).click();
}

export async function expectMoreActions(
  page: Page,
  present: readonly (string | RegExp)[],
  absent: readonly (string | RegExp)[] = [],
) {
  const trigger = page.getByRole('button', { name: 'More actions' });
  if (present.length === 0) {
    await expect(trigger).toHaveCount(0);
    return;
  }
  await expect(trigger).toBeVisible();
  await trigger.click();
  for (const name of present) {
    await expect(page.getByRole('menuitem', { name })).toBeVisible();
  }
  for (const name of absent) {
    await expect(page.getByRole('menuitem', { name })).toHaveCount(0);
  }
  await page.keyboard.press('Escape');
}

export async function deleteFromMoreActions(page: Page, name: string) {
  await chooseMoreAction(page, name);
  const action = name === 'Delete proposal'
    ? 'deleteIssue'
    : name === 'Delete report'
      ? 'deleteFacility'
      : 'deleteAnnouncement';
  await expectBackendAction(page, action, async () => {
    await page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Confirm delete' })
      .click();
  });
}

export async function createProposal(
  page: Page,
  categoryId: string,
  title: string,
) {
  await page.goto(`/issues/${categoryId}/new`);
  await page.getByRole('textbox', { name: 'Proposal title' }).fill(title);
  await page.getByRole('textbox', { name: 'Proposal content' }).fill(`${title} details`);
  await expectBackendAction(page, 'createIssue', async () => {
    await page.getByRole('button', { name: 'Submit proposal' }).click();
  });
  await expect(page).toHaveURL(
    new RegExp(`/issues/${categoryId}/(?!new)[^/]+$`, 'u'),
    { timeout: 30_000 },
  );
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  return page.url();
}

export async function createFacility(
  page: Page,
  categoryId: string,
  title: string,
) {
  await page.goto(`/facilities/new?category=${categoryId}`);
  await page.getByRole('textbox', { name: 'Report title' }).fill(title);
  await page.getByRole('textbox', { name: 'Location' }).fill(`${title} location`);
  await page.getByRole('textbox', { name: 'Problem description' }).fill(`${title} details`);
  await expectBackendAction(page, 'createFacility', async () => {
    await page.getByRole('button', { name: 'Submit report' }).click();
  });
  await expect(page).toHaveURL(/\/facilities\/(?!new)[^/]+$/u, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  return page.url();
}

export async function createAnnouncement(page: Page, title: string) {
  await page.goto('/announcements/new');
  await page.getByRole('textbox', { name: 'Announcement title' }).fill(title);
  await page.getByRole('textbox', { name: 'Announcement content' }).fill(`${title} details`);
  await expectBackendAction(page, 'createAnnouncement', async () => {
    await page.getByRole('button', { name: 'Publish announcement' }).click();
  });
  await expect(page).toHaveURL(/\/announcements\/(?!new)[^/]+$/u, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  return page.url();
}
