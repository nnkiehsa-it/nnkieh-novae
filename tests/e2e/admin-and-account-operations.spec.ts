import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { E2E_USERS } from './support/accounts';
import { expectBackendAction } from './support/backend-action';
import { readContentState } from './support/content-state';
import { newUserPage } from './support/session';
import { selectAdminSection } from './pages/admin-page';

test('a late overview failure cannot replace the selected reporting period', async ({ browser }) => {
  const { page, context } = await newUserPage(browser, 'admin');
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let requested = false;
  await page.route('**/v1/actions', async (route) => {
    const body = route.request().postDataJSON();
    if (body?.action !== 'getAdminOverview' || body?.payload?.window !== '7d') {
      await route.continue();
      return;
    }
    requested = true;
    await held;
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'upstream-unavailable', message: 'Late previous period failure' } }) });
  });
  try {
    await page.goto('/admin?view=statistics');
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
    await page.getByRole('tab', { name: '7 days', exact: true }).click();
    await expect.poll(() => requested).toBe(true);
    await page.getByRole('tab', { name: '30 days', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
    const completed = page.waitForResponse((response) => {
      const body = response.request().postDataJSON();
      return body?.action === 'getAdminOverview' && body?.payload?.window === '7d';
    });
    release();
    await (await completed).finished();
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole('tab', { name: '30 days', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Late previous period failure')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Refresh', exact: true })).toBeEnabled();
  } finally { release(); await context.close(); }
});

test('platform admin can restrict and restore an ordinary account', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto('/admin/people?view=accounts');
  const search = admin.page.getByPlaceholder('Search name, campus email, or UID');
  await search.fill(E2E_USERS.other);
  await admin.page.getByRole('button', { name: 'Search', exact: true }).click();
  // Searching narrows the list to what was typed, rather than reloading it as it was.
  await expect(
    admin.page.getByRole('main').getByText('@integration.invalid').filter({ visible: true }),
  ).toHaveCount(1);
  // Every person row states the account's standing, not only the restricted ones.
  await expect(
    admin.page.getByRole('main').getByText('Normal', { exact: true }),
  ).toBeVisible();
  await admin.page.getByRole('button', { name: 'Clear search and show all records', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect.poll(() => admin.page.getByRole('main').getByText('@integration.invalid').filter({ visible: true }).count()).toBeGreaterThan(1);
  await search.fill(E2E_USERS.other);
  await admin.page.getByRole('button', { name: 'Search', exact: true }).click();
  await admin.page.getByText(E2E_USERS.other).filter({ visible: true }).click();
  await admin.page.getByLabel('Restriction reason / displayed message').fill('E2E reversible restriction');
  await expectBackendAction(admin.page, 'saveAccountAccessRule', async () => {
    await admin.page.getByRole('button', { name: 'Apply rule' }).click();
  });
  await admin.page.reload();
  await admin.page.getByPlaceholder('Search name, campus email, or UID').fill(E2E_USERS.other);
  await admin.page.getByRole('button', { name: 'Search', exact: true }).click();
  await admin.page.getByText(E2E_USERS.other).filter({ visible: true }).click();
  await expect(admin.page.getByText('Effective rule')).toBeVisible();
  await expectBackendAction(admin.page, 'deleteAccountAccessRule', async () => {
    await admin.page.getByRole('button', { name: 'Clear restriction' }).click();
  });
  await expect(admin.page.getByLabel('Restriction reason / displayed message')).toBeVisible();
  await admin.context.close();
});

test('admin views support direct links, reload and browser history', async ({ browser }) => {
  const admin = await newUserPage(browser, 'admin');
  for (const [route, next, label] of [
    ['/admin/platform', 'images', 'Image uploads'],
    ['/admin/content', 'facility', 'Facilities'],
    ['/admin/people', 'restrictions', 'Access rules'],
    ['/admin/audit', 'activity', 'Platform activity'],
    ['/admin/system', 'capacity', 'Capacity'],
    ['/admin/policies', 'jobs', 'Background jobs'],
  ]) {
    await admin.page.goto(`${route}?view=${next}`);
    await expect(admin.page.getByRole('main').getByRole('heading', { level: 2, name: label, exact: true })).toBeVisible();
  }
  await admin.page.reload();
  await expect(admin.page.getByRole('heading', { level: 2, name: 'Background jobs', exact: true })).toBeVisible();
  await admin.page.getByRole('button', { name: 'Back to section summary', exact: true }).click();
  await expect(admin.page).toHaveURL(/\/admin\/policies$/u);
  await admin.page.goBack();
  await expect(admin.page.getByRole('heading', { level: 2, name: 'Background jobs', exact: true })).toBeVisible();
  await admin.context.close();
});

test('account restrictions show the configured message for denied actions and blocked login', async ({ browser }) => {
  test.setTimeout(120_000);
  const database = new Client({ connectionString: process.env.DATABASE_OWNER_URL });
  await database.connect();
  const [{ rows: targetRows }, { rows: adminRows }] = await Promise.all([
    database.query<{ uid: string }>('select uid from app_private.user_profiles where email = $1', [E2E_USERS.other]),
    database.query<{ uid: string }>('select uid from app_private.user_profiles where email = $1', [E2E_USERS.admin]),
  ]);
  const targetUid = targetRows[0]?.uid;
  const adminUid = adminRows[0]?.uid;
  expect(targetUid).toBeTruthy();
  expect(adminUid).toBeTruthy();
  const actionMessage = 'E2E read-only message';
  const blockedMessage = 'E2E blocked login message';

  try {
    await database.query(
      `insert into app_private.user_restrictions
        (uid, target_type, preset, restricted_permanently, restricted_until, reason, updated_by)
       values ($1, 'uid', 'read_only', true, null, $2, $3)
       on conflict (target_type, uid) do update set
         preset = excluded.preset,
         restricted_permanently = excluded.restricted_permanently,
         restricted_until = excluded.restricted_until,
         reason = excluded.reason,
         updated_by = excluded.updated_by,
         updated_at = now()`,
      [targetUid, actionMessage, adminUid],
    );

    const content = await readContentState();
    const restricted = await newUserPage(browser, 'other');
    await restricted.page.goto(content.proposalA);
    await restricted.page.getByRole('button', { name: /Support this proposal|Remove support/u }).click();
    await expect(restricted.page.getByText(actionMessage, { exact: false })).toBeVisible();
    await restricted.context.close();

    await database.query(
      `update app_private.user_restrictions
       set preset = 'blocked', reason = $2, updated_at = now()
       where target_type = 'uid' and uid = $1`,
      [targetUid, blockedMessage],
    );
    const blocked = await newUserPage(browser, 'other');
    await blocked.page.goto('/issues');
    await expect(blocked.page).toHaveURL(/\/login/u, { timeout: 20_000 });
    await expect(blocked.page.getByText(blockedMessage, { exact: true })).toBeVisible();
    await blocked.context.close();
  } finally {
    await database.query(
      `delete from app_private.user_restrictions
       where target_type = 'uid' and uid = $1`,
      [targetUid],
    );
    await database.end();
  }
});

test('login fills the desktop viewport edge to edge', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in with a school account' })).toBeVisible();
  const geometry = await page.locator('main').evaluate((main) => {
    const mainRect = main.getBoundingClientRect();
    return {
      mainBottom: mainRect.bottom,
      mainLeft: mainRect.left,
      mainRight: mainRect.right,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  expect(geometry.mainLeft).toBe(0);
  expect(geometry.mainRight).toBe(geometry.viewportWidth);
  expect(geometry.mainBottom).toBeGreaterThanOrEqual(geometry.viewportHeight);
  await context.close();
});

test('image settings save estimates no cleanup and issues only the canonical write', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto('/admin/platform');
  await expect(admin.page.getByRole('group', { name: 'Section summary' })).toBeVisible();
  // Nothing is submittable until something has actually been changed.
  await expect(admin.page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  await selectAdminSection(admin.page, 'Image uploads');
  const imageDimension = admin.page.getByLabel('Maximum image dimension (px)', { exact: true });
  await imageDimension.fill(String(Number(await imageDimension.inputValue()) === 1600 ? 1601 : 1600));
  await imageDimension.blur();
  await expect(admin.page.getByText('1 unsaved changes')).toBeVisible();
  await expectBackendAction(admin.page, 'savePlatformSettings', async () => {
    await admin.page.getByRole('button', { name: 'Save', exact: true }).click();
  });
  await expect(admin.page.getByRole('alertdialog')).toHaveCount(0);
  await admin.context.close();
});

test('setting presets remain drafts, restore one area, and show reviewable changes', async ({ browser }) => {
  const admin = await newUserPage(browser, 'admin');
  const writes: string[] = [];
  admin.page.on('request', (request) => {
    if (!request.url().endsWith('/v1/actions') || request.method() !== 'POST') return;
    const action = request.postDataJSON()?.action;
    if (action === 'savePlatformSettings') writes.push(action);
  });
  await admin.page.goto('/admin/platform');
  await selectAdminSection(admin.page, 'Image uploads');
  const dimension = admin.page.getByLabel('Maximum image dimension (px)', { exact: true });
  const original = await dimension.inputValue();
  await admin.page.getByText('Quick settings', { exact: true }).click();
  await admin.page.getByRole('button', { name: /Detailed images/u }).click();
  await expect(dimension).toHaveValue('3000');
  await admin.page.getByRole('button', { name: 'Restore saved settings in this section', exact: true }).click();
  await expect(dimension).toHaveValue(original);
  await admin.page.getByRole('button', { name: /Detailed images/u }).click();
  await selectAdminSection(admin.page, 'Quick settings');
  await admin.page.getByRole('button', { name: 'Quick settings', exact: true }).click();
  await admin.page.getByRole('button', { name: /^Compact/u }).click();
  await admin.page.getByRole('button', { name: 'Restore saved settings in this section', exact: true }).click();
  await selectAdminSection(admin.page, 'Image uploads');
  await expect(dimension).toHaveValue('3000');
  await admin.page.getByRole('button', { name: 'Review changes', exact: true }).click();
  await expect(admin.page.getByRole('alertdialog').getByText('Maximum image dimension (px)', { exact: true })).toBeVisible();
  await admin.page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click();
  await admin.page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(dimension).toHaveValue(original);
  expect(writes).toEqual([]);
  await admin.context.close();
});

test('a stale settings tab keeps its draft, reports the conflict, and reloads the canonical value', async ({ browser }, testInfo) => {
  const admin = await newUserPage(browser, 'admin');
  const stale = await admin.context.newPage();
  await stale.setViewportSize({ width: 390, height: 900 });
  try {
    await admin.page.goto('/admin/platform?view=images');
    await stale.goto('/admin/platform?view=images');
    const field = 'Maximum image dimension (px)';
    const current = admin.page.getByLabel(field, { exact: true });
    const previous = stale.getByLabel(field, { exact: true });
    await expect(current).toBeVisible();
    await expect(previous).toHaveValue(await current.inputValue());
    const savedValue = String(Number(await current.inputValue()) === 1700 ? 1701 : 1700);
    await current.fill(savedValue);
    await current.blur();
    await previous.fill('1702');
    await previous.blur();
    await expectBackendAction(admin.page, 'savePlatformSettings', async () => {
      await admin.page.getByRole('button', { name: 'Save', exact: true }).click();
    });
    await stale.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(stale.getByRole('alert').filter({ hasText: 'These settings changed in another operation.' })).toContainText('These settings changed in another operation. Your changes were not saved. Discard the draft and reload before editing again.');
    await expect(previous).toHaveValue('1702');
    await expect.poll(() => stale.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await stale.screenshot({ path: testInfo.outputPath('settings-conflict-390.png') });
    await expectBackendAction(stale, 'getCategoryManagement', async () => {
      await stale.getByRole('button', { name: 'Discard draft and reload', exact: true }).click();
    });
    await expect(previous).toHaveValue(savedValue);
    await expect(stale.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  } finally {
    await admin.context.close();
  }
});

test('disabling notification cleanup confirms retention updates rather than deletion', async ({ browser }) => {
  const admin = await newUserPage(browser, 'admin');
  const database = new Client({ connectionString: process.env.DATABASE_OWNER_URL });
  await database.connect();
  const id = randomUUID();
  try {
    await database.query(`insert into app_private.notifications(id,source,type,target_type,target_id,title,created_at,expires_at)
      values ($1::uuid,'broadcast','retention-test','announcement',$2,'Retain this notification',now()-interval '40 days',now()-interval '10 days')`, [id, id]);
    await admin.page.goto('/admin/platform?view=retention-content');
    const enabled = admin.page.getByRole('switch', { name: 'Automatically delete old notifications', exact: true });
    await expect(enabled).toBeChecked();
    await enabled.click();
    await admin.page.getByRole('button', { name: 'Save', exact: true }).click();
    const review = admin.page.getByRole('alertdialog');
    await expect(review.getByText(/update the retention expiry/u)).toBeVisible();
    await expect(review.getByText(/remove .* stored records/u)).toHaveCount(0);
    await expectBackendAction(admin.page, 'savePlatformSettings', async () => {
      await review.getByRole('button', { name: 'Save and start', exact: true }).click();
    });
    await expect(enabled).not.toBeChecked();
    await database.query('select app_api.backend_process_platform_job_batch(100)');
    await database.query('delete from app_private.notifications where id=$1', [id]);
    await enabled.click();
    await admin.page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(review.getByText(/update the retention expiry/u)).toBeVisible();
    await expectBackendAction(admin.page, 'savePlatformSettings', async () => {
      await review.getByRole('button', { name: 'Save and start', exact: true }).click();
    });
  } finally {
    await database.query('delete from app_private.notifications where id=$1', [id]);
    await database.end();
    await admin.context.close();
  }
});

test('operations console is usable on phone and desktop and saves an audited policy revision', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const admin = await newUserPage(browser,'admin');
  for(const width of [390,1440]) {
    await admin.page.setViewportSize({width,height:900});
    await admin.page.goto('/admin/system?view=failures');
    await expect(admin.page.getByRole('heading',{name:'System',exact:true})).toBeVisible();
    await expect.poll(()=>admin.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await admin.page.screenshot({path:testInfo.outputPath(`system-${width}.png`)});
    // Capacity is a view of its own, and it carries the widest rows on the screen.
    await selectAdminSection(admin.page, 'Capacity');
    await expect(admin.page.getByRole('heading',{name:'Database storage'})).toBeVisible();
    await expect.poll(()=>admin.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await admin.page.screenshot({path:testInfo.outputPath(`system-capacity-${width}.png`)});
    await admin.page.goto('/admin/policies');
    await expect.poll(()=>admin.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await selectAdminSection(admin.page, 'Client');
    await admin.page.getByLabel('Client Write Cooldown Ms',{exact:true}).scrollIntoViewIfNeeded();
    await expect(admin.page.getByLabel('Client Write Cooldown Ms',{exact:true})).toHaveValue('500');
    await expect(admin.page.getByRole('button', { name: 'Back to section summary', exact: true })).toBeVisible();
    await admin.page.screenshot({path:testInfo.outputPath(`policies-${width}.png`)});
  }
  const cooldown = admin.page.getByLabel('Client Write Cooldown Ms',{exact:true});
  await cooldown.fill('600');
  await cooldown.blur();
  await admin.page.getByPlaceholder('Reason for change (required)').fill('E2E operational policy audit');
  await expectBackendAction(admin.page,'saveOperationPolicies',async()=>{
    await admin.page.getByRole('button',{name:'Save',exact:true}).click();
  });
  await admin.page.getByText('Policy history', { exact: true }).click();
  await expect(admin.page.getByText('E2E operational policy audit',{exact:false})).toBeVisible();
  await admin.context.close();
});

test('notification visit and platform-admin preferences issue one canonical write', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await newUserPage(browser, 'admin');
  await expectBackendAction(admin.page, 'markNotificationsOpened', async () => {
    await admin.page.goto('/notifications');
  });
  await admin.page.goto('/settings');
  const labels = ['Comment notifications', 'Proposal updates', 'Facility updates'];
  const before: Record<string, string | null> = {};
  for (const label of labels) {
    const toggle = admin.page.getByRole('switch', { exact: true, name: label });
    before[label] = await toggle.getAttribute('data-state');
    await toggle.click();
  }
  // Toggling changes nothing until the screen is saved, and then it is one write.
  await expect(admin.page.getByText('3 unsaved changes')).toBeVisible();
  await expectBackendAction(admin.page, 'updatePlatformAdminNotificationPreferences', async () => {
    await admin.page.getByRole('button', { name: 'Save', exact: true }).click();
  });
  for (const label of labels) {
    const toggle = admin.page.getByRole('switch', { exact: true, name: label });
    await expect(toggle).toHaveAttribute(
      'data-state',
      before[label] === 'checked' ? 'unchecked' : 'checked',
    );
  }
  await admin.context.close();
});

test('failed provider deletion can be retried from the operational UI', async ({ browser }) => {
  test.setTimeout(120_000);
  const database = new Client({ connectionString: process.env.DATABASE_OWNER_URL });
  await database.connect();
  const targetId = `e2e-retry-${Date.now()}`;
  const jobId = randomUUID();
  await database.query(
    `insert into app_private.background_jobs (
      id, job_type, scope_id, payload, status, attempt_count, last_attempt_id, error_detail, next_attempt_at
    ) values ($1, 'deletion', $2, $3::jsonb, 'failed', 1, $4, $5::jsonb, now() + interval '1 day')`,
    [
      jobId,
      targetId,
      JSON.stringify({ cloudinary_public_id: targetId, target_id: targetId, target_type: 'e2e-probe' }),
      randomUUID(),
      JSON.stringify({ message: 'E2E seeded provider failure' }),
    ],
  );
  try {
    const admin = await newUserPage(browser, 'admin');
    await admin.page.goto('/admin/system?view=failures');
    // The failure names what went wrong, and opens onto the whole record.
    const failure = admin.page.getByText('E2E seeded provider failure').first();
    await expect(failure).toBeVisible();
    await failure.click();
    const details = admin.page.getByRole('dialog');
    await expect(details.getByText(jobId)).toBeVisible();
    await expect(details.locator('[data-slot="dialog-header"]')).toHaveCSS('position', 'sticky');
    const dialogMetrics = await details.evaluate((element) => ({
      fits: element.scrollWidth <= element.clientWidth,
      width: element.getBoundingClientRect().width,
    }));
    expect(dialogMetrics.fits).toBe(true);
    expect(dialogMetrics.width).toBeGreaterThanOrEqual(640);
    await expectBackendAction(admin.page, 'retryOperationalWork', async () => {
      await details.getByRole('button', { name: 'Retry', exact: true }).click();
    });
    await expect(admin.page.getByText('E2E seeded provider failure')).toHaveCount(0);
    await admin.context.close();
  } finally {
    await database.query('delete from app_private.background_jobs where id = $1', [jobId]);
    await database.end();
  }
});
