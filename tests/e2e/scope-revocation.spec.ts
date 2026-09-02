import { expect, test } from '@playwright/test';
import { openAccessManagement, setMemberAccess } from './pages/access-page';
import { expectMoreActions } from './pages/content-pages';
import { E2E_USERS } from './support/accounts';
import { readContentState } from './support/content-state';
import { newUserPage } from './support/session';

test('revoking one scope preserves the same member proposal and second-category scopes', async ({
  browser,
}) => {
  const content = await readContentState();
  const admin = await newUserPage(browser, 'admin');
  await openAccessManagement(admin.page);
  await setMemberAccess(
    admin.page,
    { category: 'Proposal A', kind: 'issue' },
    E2E_USERS.other,
    true,
  );
  await setMemberAccess(
    admin.page,
    { category: 'Proposal B', kind: 'issue' },
    E2E_USERS.other,
    true,
  );
  await setMemberAccess(
    admin.page,
    { category: 'Facility A', kind: 'facility' },
    E2E_USERS.other,
    true,
  );
  await setMemberAccess(
    admin.page,
    { kind: 'announcement' },
    E2E_USERS.other,
    true,
  );

  const manager = await newUserPage(browser, 'other');
  await manager.page.goto(content.facilityA);
  await expectMoreActions(manager.page, ['Update status', 'Delete report']);
  await manager.page.goto(content.proposalA);
  await expectMoreActions(manager.page, ['Manage status', 'Delete proposal']);
  await manager.page.goto(content.proposalB);
  await expectMoreActions(manager.page, ['Manage status', 'Delete proposal']);
  await manager.page.goto('/announcements/new');
  await expect(manager.page.getByRole('heading', { name: 'Publish announcement' })).toBeVisible();

  await setMemberAccess(
    admin.page,
    { category: 'Facility A', kind: 'facility' },
    E2E_USERS.other,
    false,
  );
  await manager.page.goto(content.facilityA);
  await expectMoreActions(manager.page, [], ['Update status', 'Delete report']);
  await manager.page.goto(content.proposalA);
  await expectMoreActions(manager.page, ['Manage status', 'Delete proposal']);
  await manager.page.goto('/announcements/new');
  await expect(manager.page.getByRole('heading', { name: 'Publish announcement' })).toBeVisible();

  await setMemberAccess(
    admin.page,
    { category: 'Proposal A', kind: 'issue' },
    E2E_USERS.other,
    false,
  );
  await manager.page.goto(content.proposalA);
  await expectMoreActions(manager.page, [], ['Manage status', 'Delete proposal']);
  await manager.page.goto(content.proposalB);
  await expectMoreActions(manager.page, ['Manage status', 'Delete proposal']);

  await setMemberAccess(
    admin.page,
    { category: 'Proposal B', kind: 'issue' },
    E2E_USERS.other,
    false,
  );
  await setMemberAccess(
    admin.page,
    { kind: 'announcement' },
    E2E_USERS.other,
    false,
  );
  await manager.page.goto('/announcements/new');
  await expect(manager.page).not.toHaveURL(/\/announcements\/new/u);
  await setMemberAccess(
    admin.page,
    { category: 'Facility A', kind: 'facility' },
    E2E_USERS.facilityManager,
    true,
  );
  await manager.context.close();
  await admin.context.close();
});
