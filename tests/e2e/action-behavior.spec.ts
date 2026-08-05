import { expect, test } from '@playwright/test';
import {
  createAnnouncement,
  createFacility,
  createProposal,
} from './pages/content-pages';
import { readContentState } from './support/content-state';
import { newUserPage } from './support/session';

test('proposal comment, sharing, and status actions persist', async ({
  browser,
}) => {
  const content = await readContentState();
  const manager = await newUserPage(browser, 'issueManager');
  await manager.page.goto(content.proposalA);
  await expect(manager.page.getByRole('textbox', { name: 'Write a comment…' })).toBeVisible();

  const other = await newUserPage(browser, 'other');
  await other.page.goto(content.proposalA);
  await other.page.getByRole('textbox', { name: 'Write a comment…' }).fill('E2E proposal comment');
  await other.page.getByRole('button', { name: 'Post comment' }).click();
  await expect(other.page.getByText('E2E proposal comment').first()).toBeVisible();
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
  await other.page.getByRole('button', { name: 'Share link' }).click();
  await expect.poll(() => other.page.evaluate(
    () => (window as typeof window & { __sharedUrl?: string }).__sharedUrl,
  )).toBe(content.proposalA);
  await other.context.close();

  await manager.page.reload();
  await expect(manager.page.getByRole('textbox', { name: 'Write a comment…' })).toBeVisible();

  await manager.page.getByRole('button', { name: 'Change status or result' }).click();
  await manager.page.getByRole('button', { name: /Processing The proposal/i }).click();
  await manager.page.getByRole('button', { name: 'Confirm' }).click();
  await expect(manager.page.getByText('Processing', { exact: true })).toBeVisible();
  await manager.context.close();
});

test('facility affected and status actions persist while cross-category controls stay absent', async ({
  browser,
}) => {
  const content = await readContentState();
  const other = await newUserPage(browser, 'other');
  await other.page.goto(content.facilityA);
  const affected = other.page.getByRole('button', {
    name: /Toggle “I also encountered this”|affected/i,
  });
  const before = await affected.innerText();
  await affected.click();
  await expect.poll(() => affected.innerText()).not.toBe(before);
  await affected.click();
  await expect.poll(() => affected.innerText()).toBe(before);
  await other.context.close();

  const manager = await newUserPage(browser, 'facilityManager');
  await manager.page.goto(content.facilityA);
  await manager.page.getByRole('button', { name: 'Start processing' }).click();
  await manager.page.getByRole('button', { name: 'Confirm' }).click();
  await expect(manager.page.getByText('Processing', { exact: true })).toBeVisible();
  await manager.page.goto(content.facilityB);
  await expect(manager.page.getByRole('button', { name: /Start processing|Complete \/ Cannot resolve/i }))
    .toHaveCount(0);
  await manager.context.close();
});

test('owners and announcement managers can execute every delete path', async ({ browser }) => {
  const ordinary = await newUserPage(browser, 'ordinary');
  await createProposal(ordinary.page, 'proposal-a', 'Disposable Proposal');
  await ordinary.page.getByRole('button', { name: 'Delete proposal' }).click();
  await ordinary.page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(ordinary.page).toHaveURL(/\/issues\/proposal-a$/u);

  await createFacility(ordinary.page, 'facility-a', 'Disposable Facility');
  await ordinary.page.getByRole('button', { name: 'Delete facility report' }).click();
  await ordinary.page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(ordinary.page).toHaveURL(/\/facilities/u);
  await ordinary.context.close();

  const manager = await newUserPage(browser, 'announcementManager');
  await createAnnouncement(manager.page, 'Disposable Announcement');
  await manager.page.getByRole('button', { name: 'Delete announcement' }).click();
  await manager.page.getByRole('button', { name: 'Confirm deletion' }).click();
  await expect(manager.page).toHaveURL(/\/announcements$/u);
  await manager.context.close();
});
