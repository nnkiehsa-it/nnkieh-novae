import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { E2E_USERS } from './support/accounts';
import { expectBackendAction } from './support/backend-action';
import { newUserPage } from './support/session';

test('platform admin can restrict and restore an ordinary account', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto('/admin/management?tab=users');
  const search = admin.page.getByPlaceholder('Search name, campus email, or UID');
  await search.fill(E2E_USERS.other);
  await admin.page.getByRole('button', { name: 'Search' }).click();
  await admin.page.getByText(E2E_USERS.other).click();
  await admin.page.getByPlaceholder('Restriction reason (required)').fill('E2E reversible restriction');
  await expectBackendAction(admin.page, 'setUserRestriction', async () => {
    await admin.page.getByRole('button', { name: '7 days' }).click();
  });
  await admin.page.reload();
  await admin.page.getByPlaceholder('Search name, campus email, or UID').fill(E2E_USERS.other);
  await admin.page.getByRole('button', { name: 'Search' }).click();
  await admin.page.getByText(E2E_USERS.other).click();
  await expect(admin.page.getByText('Interactions currently restricted')).toBeVisible();
  await expectBackendAction(admin.page, 'setUserRestriction', async () => {
    await admin.page.getByRole('button', { name: 'Clear restriction' }).click();
  });
  await expect(admin.page.getByPlaceholder('Restriction reason (required)')).toBeVisible();
  await admin.context.close();
});

test('platform settings save traverses impact estimation and canonical write', async ({ browser }) => {
  test.setTimeout(120_000);
  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto('/admin/management?tab=categories');
  await admin.page.getByRole('tab', { name: 'Platform settings' }).click();
  await expect(admin.page.getByText('Image uploads')).toBeVisible();
  await expectBackendAction(admin.page, 'savePlatformSettings', async () => {
    await admin.page.getByRole('button', { name: 'Save all changes' }).click();
    const impactDialog = admin.page.getByRole('alertdialog');
    await expect(impactDialog).toBeVisible();
    await impactDialog.getByRole('button', { name: 'Save and queue' }).click();
  });
  await admin.context.close();
});

test('notification visit and every personal preference issue canonical writes', async ({ browser }) => {
  test.setTimeout(120_000);
  const member = await newUserPage(browser, 'other');
  await expectBackendAction(member.page, 'markNotificationsOpened', async () => {
    await member.page.goto('/notifications');
  });
  await member.page.goto('/settings');
  for (const label of [
    'Comment notifications',
    'Proposal updates',
    'Facility updates',
  ]) {
    const row = member.page.getByText(label, { exact: true }).locator('xpath=ancestor::label');
    const toggle = row.getByRole('switch');
    const initial = await toggle.getAttribute('data-state');
    await expectBackendAction(member.page, 'updatePushNotificationPreferences', async () => toggle.click());
    await expect(toggle).toHaveAttribute('data-state', initial === 'checked' ? 'unchecked' : 'checked');
    await expectBackendAction(member.page, 'updatePushNotificationPreferences', async () => toggle.click());
    await expect(toggle).toHaveAttribute('data-state', initial!);
  }
  await member.context.close();
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
    await admin.page.goto('/admin/management?tab=overview');
    const entry = admin.page.getByText(targetId).locator('xpath=ancestor::div[contains(@class,"space-y-2")]');
    await expect(entry).toBeVisible();
    await expectBackendAction(admin.page, 'retryDeletionJob', async () => {
      await entry.getByRole('button', { name: 'Retry' }).click();
    });
    await expect(admin.page.getByText(targetId)).toHaveCount(0);
    await admin.context.close();
  } finally {
    await database.query('delete from app_private.background_jobs where id = $1', [jobId]);
    await database.end();
  }
});
