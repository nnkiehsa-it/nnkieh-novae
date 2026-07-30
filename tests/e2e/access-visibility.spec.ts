import { expect, test } from '@playwright/test';
import { readContentState } from './support/content-state';
import { newUserPage } from './support/session';

test('proposal controls follow ownership, category scope, and platform administration', async ({
  browser,
}) => {
  const content = await readContentState();
  const cases = [
    {
      absent: ['Close new comments', 'Change status or result'],
      present: ['Delete proposal'],
      url: content.proposalA,
      user: 'ordinary',
    },
    {
      absent: ['Close new comments', 'Change status or result', 'Delete proposal'],
      present: [],
      url: content.proposalA,
      user: 'other',
    },
    {
      absent: [],
      present: ['Close new comments', 'Change status or result', 'Delete proposal'],
      url: content.proposalA,
      user: 'issueManager',
    },
    {
      absent: ['Close new comments', 'Change status or result', 'Delete proposal'],
      present: [],
      url: content.proposalB,
      user: 'issueManager',
    },
    {
      absent: [],
      present: ['Close new comments', 'Change status or result', 'Delete proposal'],
      url: content.proposalB,
      user: 'admin',
    },
  ] as const;

  for (const entry of cases) {
    const { context, page } = await newUserPage(browser, entry.user);
    await page.goto(entry.url);
    await expect(page.getByRole('button', { name: 'Share link' })).toBeVisible();
    for (const name of entry.present) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
    for (const name of entry.absent) {
      await expect(page.getByRole('button', { name })).toHaveCount(0);
    }
    await context.close();
  }
});

test('facility controls follow ownership, category scope, and platform administration', async ({
  browser,
}) => {
  const content = await readContentState();
  const cases = [
    { delete: true, manage: false, url: content.facilityA, user: 'ordinary' },
    { delete: false, manage: false, url: content.facilityA, user: 'other' },
    { delete: true, manage: true, url: content.facilityA, user: 'facilityManager' },
    { delete: false, manage: false, url: content.facilityB, user: 'facilityManager' },
    { delete: true, manage: true, url: content.facilityB, user: 'admin' },
  ] as const;

  for (const entry of cases) {
    const { context, page } = await newUserPage(browser, entry.user);
    await page.goto(entry.url);
    await expect(page.getByRole('button', { name: 'Share link' })).toBeVisible();
    await expect(page.getByRole('button', { name: /affected|encountered/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete facility report' }))
      .toHaveCount(entry.delete ? 1 : 0);
    await expect(page.getByRole('button', { name: /Start processing|Complete \/ Cannot resolve/i }))
      .toHaveCount(entry.manage ? 1 : 0);
    await context.close();
  }
});

test('announcement and administration entry points reject unassigned users', async ({
  browser,
}) => {
  const content = await readContentState();
  for (const [user, canDelete] of [
    ['ordinary', false],
    ['announcementManager', true],
    ['admin', true],
  ] as const) {
    const { context, page } = await newUserPage(browser, user);
    await page.goto(content.announcement);
    await expect(page.getByRole('button', { name: 'Delete announcement' }))
      .toHaveCount(canDelete ? 1 : 0);
    await context.close();
  }

  const ordinary = await newUserPage(browser, 'ordinary');
  await ordinary.page.goto('/admin/management');
  await expect(ordinary.page).not.toHaveURL(/\/admin\/management/u);
  await ordinary.page.goto('/dashboard');
  await expect(ordinary.page).not.toHaveURL(/\/dashboard/u);
  await ordinary.context.close();

  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto('/admin/management');
  await expect(admin.page.getByRole('heading', { name: 'System settings' })).toBeVisible();
  await admin.page.goto('/dashboard');
  await expect(admin.page).toHaveURL(/\/dashboard/u);
  await admin.context.close();
});
