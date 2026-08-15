import { expect, test } from '@playwright/test';
import {
  createAnnouncement,
  createFacility,
  createProposal,
  chooseMoreAction,
  deleteFromMoreActions,
} from './pages/content-pages';
import { readContentState } from './support/content-state';
import { newUserPage } from './support/session';

test('proposal comment, sharing, and status actions persist', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const content = await readContentState();
  const manager = await newUserPage(browser, 'issueManager');
  await manager.page.goto(content.proposalA);
  await expect(manager.page.getByRole('textbox', { name: 'Enter a comment' })).toBeVisible();
  await manager.page.goto('/settings');

  const other = await newUserPage(browser, 'other');
  const commentText = `E2E proposal comment ${Date.now()}`;
  await other.page.goto(content.proposalA);
  await other.page.getByRole('textbox', { name: 'Enter a comment' }).fill(commentText);
  await other.page.getByRole('button', { name: 'Post' }).click();
  await expect(other.page.getByText(commentText).first()).toBeVisible();
  await other.page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (url: string) => {
          (window as typeof window & { __sharedUrl?: string }).__sharedUrl = url;
        },
      },
    });
  });
  await other.page.getByRole('button', { name: 'Share proposal' }).click();
  await expect.poll(() => other.page.evaluate(
    () => (window as typeof window & { __sharedUrl?: string }).__sharedUrl,
  )).toBe(content.proposalA);
  await other.context.close();

  await manager.page.goto(content.proposalA);
  await expect(manager.page.getByText(commentText).first()).toBeVisible();
  await expect(manager.page.getByRole('textbox', { name: 'Enter a comment' })).toBeVisible();

  await chooseMoreAction(manager.page, 'Manage status');
  await manager.page.getByRole('combobox', { name: 'Status' }).click();
  await manager.page.getByRole('option', { name: 'In progress' }).click();
  await manager.page.getByRole('button', { name: 'Submit' }).click();
  await expect(manager.page.getByText('In progress', { exact: true })).toBeVisible();
  await manager.context.close();
});

test('facility affected and status actions persist while cross-category controls stay absent', async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const content = await readContentState();
  const other = await newUserPage(browser, 'other');
  await other.page.goto(content.facilityA);
  const affected = other.page.getByRole('button', {
    name: /I have this issue too|Remove marker/i,
  });
  const before = await affected.getAttribute('data-liked');
  expect(before).toMatch(/^(?:true|false)$/u);
  const after = before === 'true' ? 'false' : 'true';
  await affected.click();
  await expect(affected).toHaveAttribute('data-liked', after);
  await expect(affected).not.toHaveAttribute('aria-busy', 'true');
  await affected.click();
  await expect(affected).toHaveAttribute('data-liked', before!);
  await expect(affected).not.toHaveAttribute('aria-busy', 'true');
  await other.context.close();

  const manager = await newUserPage(browser, 'facilityManager');
  await manager.page.goto(content.facilityA);
  await chooseMoreAction(manager.page, 'Update status');
  await manager.page.getByRole('combobox', { name: 'Status' }).click();
  await manager.page.getByRole('option', { name: 'In progress' }).click();
  await manager.page.getByRole('button', { name: 'Submit' }).click();
  await expect(manager.page.getByText('In progress', { exact: true })).toBeVisible();
  await manager.page.goto(content.facilityB);
  await expect(manager.page.getByRole('button', { name: 'More actions' })).toHaveCount(0);
  await manager.context.close();
});

test('owners and announcement managers can execute every delete path', async ({ browser }) => {
  test.setTimeout(150_000);
  const ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/issues/proposal-a');
  await expect(ordinary.page.getByRole('link', { name: 'New proposal' })).toBeVisible();
  const proposalUrl = await createProposal(ordinary.page, 'proposal-a', 'Disposable Proposal');
  await ordinary.page.getByRole('button', { name: 'Back to proposals' }).click();
  await expect(ordinary.page.getByText('Disposable Proposal').first()).toBeVisible();
  await ordinary.page.goto(proposalUrl);
  await deleteFromMoreActions(ordinary.page, 'Delete proposal');
  await expect(ordinary.page).toHaveURL(/\/issues\/proposal-a$/u);

  await ordinary.page.goto('/facilities?category=facility-a');
  await expect(ordinary.page.getByRole('link', { name: 'New report' })).toBeVisible();
  const facilityUrl = await createFacility(ordinary.page, 'facility-a', 'Disposable Facility');
  await ordinary.page.getByRole('button', { name: 'Back to facilities' }).click();
  await expect(ordinary.page.getByText('Disposable Facility').first()).toBeVisible();
  await ordinary.page.goto(facilityUrl);
  await deleteFromMoreActions(ordinary.page, 'Delete report');
  await expect(ordinary.page).toHaveURL(/\/facilities/u);
  await ordinary.context.close();

  const manager = await newUserPage(browser, 'announcementManager');
  await manager.page.goto('/announcements');
  await expect(manager.page.getByRole('link', { name: 'New announcement' })).toBeVisible();
  const announcementUrl = await createAnnouncement(manager.page, 'Disposable Announcement');
  await manager.page.getByRole('button', { name: 'Back to announcements' }).click();
  await expect(manager.page.getByText('Disposable Announcement').first()).toBeVisible();
  await manager.page.goto(announcementUrl);
  await deleteFromMoreActions(manager.page, 'Delete announcement');
  await expect(manager.page).toHaveURL(/\/announcements$/u);
  await manager.context.close();
});
