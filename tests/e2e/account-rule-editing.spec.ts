import { expect, test } from '@playwright/test';
import { Client } from 'pg';
import { E2E_USERS } from './support/accounts';
import { expectBackendAction } from './support/backend-action';
import { newUserPage } from './support/session';

test('restriction editors keep deadlines, preserve failed drafts, and expose remaining prefix rules', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
  const { page, context } = await newUserPage(browser, 'admin');
  const database = new Client({ connectionString: process.env.DATABASE_OWNER_URL });
  await database.connect();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  let failSave = false;
  await page.route('**/v1/actions', async (route) => {
    if (failSave && route.request().postDataJSON()?.action === 'saveAccountAccessRule') {
      await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: { code: 'upstream-unavailable', message: 'Temporary write failure' } }) });
    } else await route.continue();
  });
  const openReview = async () => {
    await expectBackendAction(page, 'previewAccountAccessRule', () => page.getByRole('dialog').getByRole('button', { name: 'Apply rule', exact: true }).click());
    const review = page.getByRole('alertdialog');
    await expect(review).toContainText('currently matches 1 registered accounts');
    await expect(review).toContainText('Individual rules take priority');
    await expect(review).toContainText('Future matching accounts');
    await expect(review).not.toContainText('stored records');
    return review;
  };
  const openUser = async (email: string) => {
    await page.getByPlaceholder('Search name, campus email, or UID').fill(email);
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.getByRole('main').getByText(email, { exact: true }).click();
    return page.getByRole('dialog');
  };
  try {
    await page.goto('/admin/people?view=restrictions');
    await page.getByRole('button', { name: 'Add prefix rule', exact: true }).click();
    await page.getByLabel('Account prefix', { exact: true }).fill('OTHER');
    await expect(page.getByLabel('Account prefix', { exact: true })).toHaveValue('other');
    await page.getByLabel('Duration', { exact: true }).click();
    await page.getByRole('option', { name: 'Custom', exact: true }).click();
    await page.getByLabel('Custom restriction hours (1–87,600)', { exact: true }).fill('5');
    await page.getByLabel('Restriction reason / displayed message').fill('Original prefix message');
    let review = await openReview();
    await expect(review).toHaveCSS('opacity', '1');
    await page.screenshot({ path: testInfo.outputPath('prefix-rule-review-desktop.png') });
    await expectBackendAction(page, 'saveAccountAccessRule', () => review.getByRole('button', { name: 'Apply rule', exact: true }).click());
    await expect(page.getByRole('dialog')).toHaveCount(0);
    const deadline = async () => (await database.query("select restricted_until::text from app_private.user_restrictions where target_type='email_prefix' and uid='other'")).rows[0].restricted_until;
    const originalDeadline = await deadline();
    await page.getByRole('button', { name: 'Edit prefix rule', exact: true }).click();
    await expect(page.getByLabel('Duration', { exact: true })).toContainText('Keep current deadline');
    await expect(page.getByLabel('Restriction reason / displayed message')).toHaveValue('Original prefix message');
    await page.getByLabel('Restriction reason / displayed message').fill('Changed prefix message');
    failSave = true;
    review = await openReview();
    await review.getByRole('button', { name: 'Apply rule', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
    await expect(page.getByLabel('Restriction reason / displayed message')).toHaveValue('Changed prefix message');
    expect(await deadline()).toBe(originalDeadline);
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath('prefix-rule-failure-390.png') });
    failSave = false;
    review = await openReview();
    await expectBackendAction(page, 'saveAccountAccessRule', () => review.getByRole('button', { name: 'Apply rule', exact: true }).click());
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await deadline()).toBe(originalDeadline);

    await page.getByRole('button', { name: 'Edit prefix rule', exact: true }).click();
    await page.getByLabel('Restriction reason / displayed message').fill('Stale local draft');
    await database.query("update app_private.user_restrictions set reason='Another administrator',updated_at=statement_timestamp() where target_type='email_prefix' and uid='other'");
    await page.getByRole('dialog').getByRole('button', { name: 'Apply rule', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('These settings changed in another operation.');
    await expect(page.getByLabel('Restriction reason / displayed message')).toHaveValue('Stale local draft');
    await page.getByRole('button', { name: 'Discard draft and reload latest rules', exact: true }).click();
    await expect(page.getByLabel('Restriction reason / displayed message')).toHaveValue('Another administrator');
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();

    await page.goto('/admin/people');
    let sheet = await openUser(E2E_USERS.other);
    await expect(sheet.getByText('other*', { exact: true })).toBeVisible();
    await sheet.getByLabel('Duration', { exact: true }).click();
    await page.getByRole('option', { name: 'Permanent', exact: true }).click();
    await sheet.getByLabel('Restriction reason / displayed message').fill('Permanent individual message');
    await expectBackendAction(page, 'saveAccountAccessRule', () => sheet.getByRole('button', { name: 'Apply rule', exact: true }).click());
    await expect(sheet.getByText('Individual account', { exact: true })).toBeVisible();
    await expect(sheet.getByLabel('Duration', { exact: true })).toContainText('Keep current deadline');
    await expect(sheet.getByText('Permanent', { exact: true }).first()).toBeVisible();
    await expectBackendAction(page, 'deleteAccountAccessRule', () => sheet.getByRole('button', { name: 'Clear restriction', exact: true }).click());
    await expect(page.getByText('Individual rule removed; the prefix rule still restricts this account', { exact: true })).toBeVisible();
    await expect(sheet.getByText('other*', { exact: true })).toBeVisible();
    await expect(sheet.getByLabel('Restriction reason / displayed message')).toHaveValue('');
    await sheet.getByLabel('Restriction reason / displayed message').fill('Unsaved account-specific draft');
    await sheet.getByRole('button', { name: 'Close', exact: true }).click();
    sheet = await openUser(E2E_USERS.ordinary);
    await expect(sheet.getByLabel('Restriction reason / displayed message')).toHaveValue('');
    await expect(sheet.getByLabel('Duration', { exact: true })).toContainText('7 days');
    expect(errors).toEqual([]);
  } finally {
    await database.query("delete from app_private.user_restrictions where (target_type='email_prefix' and uid='other') or (target_type='uid' and uid in (select uid from app_private.user_profiles where email=$1))", [E2E_USERS.other]);
    await database.end();
    await context.close();
  }
});
