import { expect, test } from '@playwright/test';
import { readContentState } from './support/content-state';
import { newUserPage } from './support/session';
import { expectMoreActions } from './pages/content-pages';

test('proposal controls follow ownership, category scope, and platform administration', async ({
  browser,
}) => {
  const content = await readContentState();
  const cases = [
    {
      absent: [],
      present: ['Manage status', 'Delete proposal'],
      url: content.proposalA,
      user: 'ordinary',
    },
    {
      absent: ['Manage status', 'Delete proposal'],
      present: [],
      url: content.proposalA,
      user: 'other',
    },
    {
      absent: [],
      present: ['Manage status', 'Delete proposal'],
      url: content.proposalA,
      user: 'issueManager',
    },
    {
      absent: ['Manage status', 'Delete proposal'],
      present: [],
      url: content.proposalB,
      user: 'issueManager',
    },
    {
      absent: [],
      present: ['Manage status', 'Delete proposal'],
      url: content.proposalB,
      user: 'admin',
    },
  ] as const;

  for (const entry of cases) {
    const { context, page } = await newUserPage(browser, entry.user);
    await page.goto(entry.url);
    await expect(page.getByRole('button', { name: 'Share proposal' })).toBeVisible();
    await expectMoreActions(page, entry.present, entry.absent);
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
    await expect(page.getByRole('button', { name: 'Share facility report' })).toBeVisible();
    await expect(page.getByRole('button', { name: /I have this issue too|Remove marker/i }))
      .toBeVisible();
    await expectMoreActions(
      page,
      [
        ...(entry.manage ? ['Update status'] : []),
        ...(entry.delete ? ['Delete report'] : []),
      ],
      [
        ...(!entry.manage ? ['Update status'] : []),
        ...(!entry.delete ? ['Delete report'] : []),
      ],
    );
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
    await expectMoreActions(
      page,
      canDelete ? ['Delete announcement'] : [],
      canDelete ? [] : ['Delete announcement'],
    );
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
  await expect(admin.page.getByRole('heading', { name: 'Platform management' })).toBeVisible();
  await admin.page.goto('/dashboard');
  await expect(admin.page).toHaveURL(/\/dashboard/u);
  await admin.context.close();
});
