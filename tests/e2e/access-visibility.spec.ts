import { expect, test } from '@playwright/test';
import { expectBackendAction } from './support/backend-action';
import { readContentState } from './support/content-state';
import { newUserPage } from './support/session';
import { expectMoreActions } from './pages/content-pages';

test('proposal controls follow ownership, category scope, and platform administration', async ({
  browser,
}) => {
  const content = await readContentState();
  const cases = [
    {
      absent: ['Manage status', 'Delete proposal'],
      present: [],
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

test('supporter identities stay with the author, the category manager, and the administrator', async ({
  browser,
}) => {
  const content = await readContentState();
  for (const [user, visible] of [
    ['ordinary', true],
    ['other', false],
    ['issueManager', true],
    ['admin', true],
  ] as const) {
    const { context, page } = await newUserPage(browser, user);
    await page.goto(content.proposalA);
    await expect(page.getByText('Support progress')).toBeVisible();
    const open = page.getByRole('button', { name: 'Supporters' });
    const supporters = page.getByRole('dialog', { name: 'Supporters' });
    if (!visible) {
      await expect(open).toHaveCount(0);
      await context.close();
      continue;
    }
    // Nothing about who supported is read until the row is actually opened.
    await expect(supporters).toHaveCount(0);
    await expectBackendAction(page, 'listIssueSupporters', async () => {
      await open.click();
    });
    // The author counts as the first supporter, so their name is always listed.
    await expect(supporters.getByText('ordinary', { exact: true })).toBeVisible();
    await context.close();
  }
});

test('facility controls follow ownership, category scope, and platform administration', async ({
  browser,
}) => {
  const content = await readContentState();
  const cases = [
    { delete: false, manage: false, url: content.facilityA, user: 'ordinary' },
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
    ['issueManager', false],
    ['facilityManager', false],
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
  await ordinary.page.goto('/admin');
  await expect(ordinary.page).not.toHaveURL(/\/admin/u);
  await ordinary.context.close();

  // A scoped manager reaches administration, but only the areas they own.
  for (const user of ['issueManager', 'facilityManager', 'announcementManager'] as const) {
    const scopedManager = await newUserPage(browser, user);
    await scopedManager.page.goto('/admin/policies');
    await expect(scopedManager.page).not.toHaveURL(/\/admin\/policies/u);
    await scopedManager.page.goto('/admin/system');
    await expect(scopedManager.page).not.toHaveURL(/\/admin\/system/u);
    await scopedManager.context.close();
  }

  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto('/admin');
  await expect(admin.page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  for (const area of ['content', 'platform', 'people', 'audit', 'system', 'policies']) {
    await admin.page.goto(`/admin/${area}`);
    await expect(admin.page).toHaveURL(new RegExp(`/admin/${area}$`, 'u'));
  }
  await admin.context.close();
});

test('desktop account menu administration item is a real navigation link', async ({ browser }) => {
  const admin = await newUserPage(browser, 'admin');
  await admin.page.setViewportSize({ width: 1280, height: 900 });
  await admin.page.goto('/issues');

  const accountButton = admin.page.locator('aside button').last();
  await accountButton.click();
  const administration = admin.page.getByRole('menuitem', { name: /Administration|平台管理/u });
  await expect(administration).toHaveAttribute('href', '/admin');
  await administration.click();
  await expect(admin.page).toHaveURL(/\/admin$/u);

  await admin.context.close();
});
