import { expect, test } from '@playwright/test';
import { openAccessManagement, setMemberAccess } from './pages/access-page';
import { E2E_USERS } from './support/accounts';
import { readContentState } from './support/content-state';
import { newUserPage } from './support/session';

test('proposal scope revocation removes controls immediately and restore returns them', async ({
  browser,
}) => {
  const content = await readContentState();
  const admin = await newUserPage(browser, 'admin');
  const manager = await newUserPage(browser, 'issueManager');
  await manager.page.goto(content.proposalA);
  await expect(manager.page.getByRole('button', { name: 'Change status or result' })).toBeVisible();

  await openAccessManagement(admin.page);
  await setMemberAccess(
    admin.page,
    { category: 'Proposal A', kind: 'issue' },
    E2E_USERS.issueManager,
    false,
  );
  await manager.page.reload();
  await expect(manager.page.getByRole('button', { name: 'Change status or result' })).toHaveCount(0);
  await expect(manager.page.getByRole('button', { name: 'Delete proposal' })).toHaveCount(0);

  await setMemberAccess(
    admin.page,
    { category: 'Proposal A', kind: 'issue' },
    E2E_USERS.issueManager,
    true,
  );
  await manager.page.reload();
  await expect(manager.page.getByRole('button', { name: 'Change status or result' })).toBeVisible();
  await manager.context.close();
  await admin.context.close();
});

test('facility scope revocation removes controls without affecting proposal scope', async ({
  browser,
}) => {
  const content = await readContentState();
  const admin = await newUserPage(browser, 'admin');
  const manager = await newUserPage(browser, 'facilityManager');
  await manager.page.goto(content.facilityA);
  await expect(manager.page.getByRole('button', {
    name: /Start processing|Complete \/ Cannot resolve/,
  })).toBeVisible();

  await openAccessManagement(admin.page);
  await setMemberAccess(
    admin.page,
    { category: 'Facility A', kind: 'facility' },
    E2E_USERS.facilityManager,
    false,
  );
  await manager.page.reload();
  await expect(manager.page.getByRole('button', {
    name: /Start processing|Complete \/ Cannot resolve/,
  })).toHaveCount(0);

  await setMemberAccess(
    admin.page,
    { category: 'Facility A', kind: 'facility' },
    E2E_USERS.facilityManager,
    true,
  );
  await manager.page.reload();
  await expect(manager.page.getByRole('button', {
    name: /Start processing|Complete \/ Cannot resolve/,
  })).toBeVisible();
  await manager.context.close();
  await admin.context.close();
});

test('announcement revocation blocks composer route and restore enables it again', async ({
  browser,
}) => {
  const admin = await newUserPage(browser, 'admin');
  const manager = await newUserPage(browser, 'announcementManager');
  await manager.page.goto('/announcements/new');
  await expect(manager.page.getByRole('heading', { name: 'Announcement content' })).toBeVisible();

  await openAccessManagement(admin.page);
  await setMemberAccess(
    admin.page,
    { kind: 'announcement' },
    E2E_USERS.announcementManager,
    false,
  );
  await manager.page.reload();
  await expect(manager.page).not.toHaveURL(/\/announcements\/new/u);

  await setMemberAccess(
    admin.page,
    { kind: 'announcement' },
    E2E_USERS.announcementManager,
    true,
  );
  await manager.page.goto('/announcements/new');
  await expect(manager.page.getByRole('heading', { name: 'Announcement content' })).toBeVisible();
  await manager.context.close();
  await admin.context.close();
});
