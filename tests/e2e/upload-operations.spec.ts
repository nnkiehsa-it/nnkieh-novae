import { expect, test } from '@playwright/test';
import { expectBackendActions, readActionStream } from './support/backend-action';
import { deleteFromMoreActions } from './pages/content-pages';
import { newUserPage } from './support/session';
import { authStatePath } from './support/paths';

test('composer upload creates, finalizes, and rolls back provider resources', async ({ browser }) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({ storageState: authStatePath('ordinary'), serviceWorkers: 'block' });
  const member = { context, page: await context.newPage() };
  await member.page.goto('/issues/proposal-a/compose/new');
  const title = `Upload ${Date.now().toString().slice(-8)}`;
  await member.page.getByRole('textbox', { name: 'Proposal title' }).fill(title);
  await member.page.getByRole('textbox', { name: 'Proposal content' }).fill('The image is removed before submission.');
  const input = member.page.locator('input[type=file]');
  await input.setInputFiles(['public/pwa-64x64.png', 'public/pwa-192x192.png']);
  await expect(member.page.getByAltText('Attachment preview')).toHaveCount(2);

  // The first file succeeds and the second fails. Neither may survive as an orphan.
  let providerRequests = 0;
  await member.page.route('**/image/upload', async (route) => {
    providerRequests += 1;
    if (providerRequests === 2) {
      await expect(member.page.getByRole('button', { name: 'Delete', exact: true }).first()).toBeDisabled();
      await route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"message":"upload temporarily unavailable"}}' });
    } else await route.continue();
  });
  let receiveCleanup!: (body: string) => void;
  const cleanup = new Promise<string>((resolve) => { receiveCleanup = resolve; });
  await member.page.route('**/v1/actions', async (route) => {
    if (route.request().postDataJSON()?.action !== 'deleteUploadedImages') return route.continue();
    // Capture before the client closes its completed NDJSON reader.
    const response = await route.fetch();
    const body = await response.text();
    await route.fulfill({ response, body });
    receiveCleanup(body);
  });
  await member.page.getByRole('button', { name: 'Submit proposal' }).click();
  expect(readActionStream(await cleanup).data.deleted).toBe(2);
  await expect(member.page.getByRole('button', { name: 'Submit proposal' })).toBeEnabled();
  await expect(member.page.getByAltText('Attachment preview')).toHaveCount(2);
  await member.page.unroute('**/image/upload');

  await expectBackendActions(member.page, [
    'createImageUploadSessions',
    'finalizeImageUploads',
    'createIssue',
  ], async () => {
    await member.page.getByRole('button', { name: 'Submit proposal' }).click();
  });
  await expect(member.page.getByRole('heading', { name: title })).toBeVisible();
  const issueUrl = member.page.url();

  // The comment picker sits immediately before Send, and image-only comments render as media.
  const addImage = member.page.getByRole('button', { name: 'Add image', exact: true });
  await expect(addImage).toBeVisible();
  await member.page.getByRole('region', { name: 'Discussion' }).locator('input[type=file]').setInputFiles('public/pwa-64x64.png');
  await expect(member.page.getByAltText('Attachment preview')).toHaveCount(1);
  const send = member.page.getByRole('button', { name: 'Post', exact: true });
  await expect(send).toBeEnabled();
  await expectBackendActions(member.page, ['createImageUploadSessions', 'finalizeImageUploads', 'createComment'], async () => {
    await send.click();
  });
  const comment = member.page.locator('[data-comment-id]').first();
  await expect(comment.locator('img')).toHaveCount(1);
  await expect(comment).not.toContainText('srp-upload://');
  await comment.getByRole('button', { name: 'Reply', exact: true }).click();
  await member.page.getByRole('region', { name: 'Discussion' }).locator('input[type=file]').setInputFiles('public/pwa-192x192.png');
  await expect(member.page.getByAltText('Attachment preview')).toHaveCount(1);
  await expectBackendActions(member.page, ['createImageUploadSessions', 'finalizeImageUploads', 'createComment'], async () => {
    await member.page.getByRole('button', { name: 'Reply', exact: true }).last().click();
  });
  await expect(member.page.locator('[data-comment-id]')).toHaveCount(2);
  await member.context.close();

  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto(issueUrl);
  await expect(admin.page.getByRole('heading', { name: title })).toBeVisible();
  await deleteFromMoreActions(admin.page, 'Delete proposal');
  await admin.context.close();
});
