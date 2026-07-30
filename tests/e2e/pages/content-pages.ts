import { expect, type Page } from '@playwright/test';

export async function createProposal(
  page: Page,
  categoryId: string,
  title: string,
) {
  await page.goto(`/issues/${categoryId}/new`);
  await page.getByRole('textbox', { name: 'Proposal title' }).fill(title);
  await page.getByRole('textbox', { name: 'Detailed description' }).fill(`${title} details`);
  await page.getByRole('button', { name: 'Confirm publish' }).click();
  await expect(page).toHaveURL(new RegExp(`/issues/${categoryId}/(?!new)[^/]+$`, 'u'));
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
  await page.getByRole('textbox', { name: 'Details (optional)' }).fill(`${title} details`);
  await page.getByRole('button', { name: 'Confirm publish' }).click();
  await expect(page).toHaveURL(/\/facilities\/(?!new)[^/]+$/u);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  return page.url();
}

export async function createAnnouncement(page: Page, title: string) {
  await page.goto('/announcements/new');
  await page.getByRole('textbox', { name: 'Announcement title' }).fill(title);
  await page.getByRole('textbox', { name: 'Content description' }).fill(`${title} details`);
  await page.getByRole('button', { name: 'Publish announcement' }).click();
  await expect(page).toHaveURL(/\/announcements\/(?!new)[^/]+$/u);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  return page.url();
}
