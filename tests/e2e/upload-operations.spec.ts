import { expect, test } from '@playwright/test';
import { expectBackendActions } from './support/backend-action';
import { deleteFromMoreActions } from './pages/content-pages';
import { newUserPage } from './support/session';

test('composer upload creates, finalizes, and rolls back provider resources', async ({ browser }) => {
  test.setTimeout(150_000);
  const member = await newUserPage(browser, 'ordinary');
  await member.page.goto('/issues/proposal-a/new');
  const title = `Upload ${Date.now().toString().slice(-8)}`;
  await member.page.getByRole('textbox', { name: 'Proposal title' }).fill(title);
  await member.page.getByRole('textbox', { name: 'Proposal content' }).fill('The image is removed before submission.');
  const input = member.page.locator('input[type=file]');
  await input.setInputFiles('public/pwa-64x64.png');
  await expect(member.page.getByAltText('Attachment preview')).toBeVisible();
  await expectBackendActions(member.page, [
    'createImageUploadSessions',
    'finalizeImageUploads',
    'createIssue',
  ], async () => {
    await member.page.getByRole('button', { name: 'Submit proposal' }).click();
  });
  await expect(member.page.getByRole('heading', { name: title })).toBeVisible();
  await deleteFromMoreActions(member.page, 'Delete proposal');
  await member.context.close();
});
