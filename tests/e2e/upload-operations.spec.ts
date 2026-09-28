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
  await member.context.close();

  const admin = await newUserPage(browser, 'admin');
  await admin.page.goto(issueUrl);
  await expect(admin.page.getByRole('heading', { name: title })).toBeVisible();
  await deleteFromMoreActions(admin.page, 'Delete proposal');
  await admin.context.close();
});
