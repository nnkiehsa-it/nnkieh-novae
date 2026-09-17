import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { E2E_USERS } from './support/accounts';
import { expectBackendAction } from './support/backend-action';
import { newUserPage } from './support/session';

test('platform admin can restrict and restore an ordinary account', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto('/admin/people');
  const search = admin.page.getByPlaceholder('Search name, campus email, or UID');
  await search.fill(E2E_USERS.other);
  await admin.page.getByRole('button', { name: 'Search' }).click();
  // Searching narrows the list to what was typed, rather than reloading it as it was.
  await expect(
    admin.page.getByRole('main').getByText('@integration.invalid').filter({ visible: true }),
  ).toHaveCount(1);
  // Every person row states the account's standing, not only the restricted ones.
  await expect(
    admin.page.getByRole('main').getByText('Normal', { exact: true }),
  ).toBeVisible();
  await admin.page.getByText(E2E_USERS.other).filter({ visible: true }).click();
  await admin.page.getByLabel('Restriction reason / displayed message').fill('E2E reversible restriction');
  await expectBackendAction(admin.page, 'saveAccountAccessRule', async () => {
    await admin.page.getByRole('button', { name: 'Apply rule' }).click();
  });
  await admin.page.reload();
  await admin.page.getByPlaceholder('Search name, campus email, or UID').fill(E2E_USERS.other);
  await admin.page.getByRole('button', { name: 'Search' }).click();
  await admin.page.getByText(E2E_USERS.other).filter({ visible: true }).click();
  await expect(admin.page.getByText('Effective rule')).toBeVisible();
  await expectBackendAction(admin.page, 'deleteAccountAccessRule', async () => {
    await admin.page.getByRole('button', { name: 'Clear restriction' }).click();
  });
  await expect(admin.page.getByLabel('Restriction reason / displayed message')).toBeVisible();
  await admin.context.close();
});

test('platform settings save traverses impact estimation and canonical write', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto('/admin/platform');
  await expect(admin.page.getByText('Image uploads')).toBeVisible();
  // Nothing is submittable until something has actually been changed.
  await expect(admin.page.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
  const commentImages = admin.page.getByLabel('Images per comment', { exact: true });
  await commentImages.fill(String(Number(await commentImages.inputValue()) === 1 ? 2 : 1));
  await commentImages.blur();
  await expect(admin.page.getByText('1 unsaved changes')).toBeVisible();
  await expectBackendAction(admin.page, 'savePlatformSettings', async () => {
    await admin.page.getByRole('button', { name: 'Save', exact: true }).click();
    // The write is only issued once the estimated impact has been accepted.
    await admin.page
      .getByRole('alertdialog')
      .getByRole('button', { name: 'Save and start' })
      .click();
  });
  await admin.context.close();
});

test('operations console is usable on phone and desktop and saves an audited policy revision', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const admin = await newUserPage(browser,'admin');
  for(const width of [390,1440]) {
    await admin.page.setViewportSize({width,height:900});
    await admin.page.goto('/admin/system');
    await expect(admin.page.getByRole('heading',{name:'System',exact:true})).toBeVisible();
    await expect.poll(()=>admin.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await admin.page.screenshot({path:testInfo.outputPath(`system-${width}.png`)});
    // Capacity is a view of its own, and it carries the widest rows on the screen.
    await admin.page.getByRole('tab',{name:'Capacity'}).click();
    await expect(admin.page.getByRole('heading',{name:'Database storage'})).toBeVisible();
    await expect.poll(()=>admin.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await admin.page.screenshot({path:testInfo.outputPath(`system-capacity-${width}.png`)});
    await admin.page.goto('/admin/policies');
    await expect.poll(()=>admin.page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await admin.page.getByLabel('Client Write Cooldown Ms',{exact:true}).scrollIntoViewIfNeeded();
    await expect(admin.page.getByLabel('Client Write Cooldown Ms',{exact:true})).toHaveValue('500');
    await admin.page.screenshot({path:testInfo.outputPath(`policies-${width}.png`)});
  }
  const cooldown = admin.page.getByLabel('Client Write Cooldown Ms',{exact:true});
  await cooldown.fill('600');
  await cooldown.blur();
  await admin.page.getByPlaceholder('Reason for change (required)').fill('E2E operational policy audit');
  await expectBackendAction(admin.page,'saveOperationPolicies',async()=>{
    await admin.page.getByRole('button',{name:'Save',exact:true}).click();
  });
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
    await admin.page.goto('/admin/system');
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
