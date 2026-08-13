import { mkdir } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  E2E_USERS,
  saveSignedInState,
  signInWithEmulator,
} from './support/accounts';
import { authStateDir, authStatePath } from './support/paths';
import { completeInitialSetup } from './pages/setup-page';
import { openAccessManagement, setMemberAccess } from './pages/access-page';
import {
  createAnnouncement,
  createFacility,
  createProposal,
} from './pages/content-pages';
import { newUserPage } from './support/session';
import { readContentState, writeContentState } from './support/content-state';

test('bootstrap real accounts, categories, and scoped managers through the UI', async ({
  browser,
  page,
}) => {
  test.setTimeout(300_000);
  await mkdir(authStateDir, { recursive: true });
  await signInWithEmulator(page, E2E_USERS.admin);
  if (/\/setup$/u.test(page.url())) await completeInitialSetup(page);
  await page.context().storageState({ indexedDB: true, path: authStatePath('admin') });

  for (const [name, email] of Object.entries(E2E_USERS)) {
    if (name === 'admin') continue;
    await saveSignedInState(browser, email, authStatePath(name));
  }

  await openAccessManagement(page);
  await setMemberAccess(
    page,
    { category: 'Proposal A', kind: 'issue' },
    E2E_USERS.issueManager,
    true,
  );
  await setMemberAccess(
    page,
    { category: 'Facility A', kind: 'facility' },
    E2E_USERS.facilityManager,
    true,
  );
  await setMemberAccess(
    page,
    { kind: 'announcement' },
    E2E_USERS.announcementManager,
    true,
  );

  let contentStillExists: boolean;
  try {
    const existing = await readContentState();
    const ordinary = await newUserPage(browser, 'ordinary');
    for (const url of Object.values(existing)) {
      await ordinary.page.goto(url);
      await expect(ordinary.page.getByRole('heading', { name: /^E2E /u }))
        .toBeVisible({ timeout: 5_000 });
    }
    await ordinary.context.close();
    contentStillExists = true;
  } catch {
    contentStillExists = false;
  }

  if (!contentStillExists) {
    const ordinary = await newUserPage(browser, 'ordinary');
    const proposalA = await createProposal(ordinary.page, 'proposal-a', 'E2E Proposal A');
    const proposalB = await createProposal(ordinary.page, 'proposal-b', 'E2E Proposal B');
    const facilityA = await createFacility(ordinary.page, 'facility-a', 'E2E Facility A');
    const facilityB = await createFacility(ordinary.page, 'facility-b', 'E2E Facility B');
    await ordinary.context.close();

    const announcementManager = await newUserPage(browser, 'announcementManager');
    const announcement = await createAnnouncement(
      announcementManager.page,
      'E2E Announcement',
    );
    await announcementManager.context.close();
    await writeContentState({ announcement, facilityA, facilityB, proposalA, proposalB });
  }
});
