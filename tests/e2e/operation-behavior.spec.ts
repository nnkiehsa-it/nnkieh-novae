import { expect, test, type Page } from '@playwright/test';
import {
  chooseMoreAction,
  createAnnouncement,
  createFacility,
  createProposal,
  deleteFromMoreActions,
} from './pages/content-pages';
import { expectBackendAction, expectBackendActions } from './support/backend-action';
import { newUserPage } from './support/session';

async function createComment(page: Page, text: string, action: 'createComment' | 'createAnnouncementComment') {
  await page.getByRole('textbox', { name: 'Enter a comment' }).fill(text);
  await expectBackendAction(page, action, async () => {
    await page.getByRole('button', { name: 'Post' }).click();
  });
  await expect(page.getByText(text).first()).toBeVisible();
}

async function replyToComment(page: Page, text: string, action: 'createComment' | 'createAnnouncementComment') {
  await page.getByRole('button', { name: 'Reply' }).first().click();
  await page.getByRole('textbox', { name: 'Enter a reply' }).fill(text);
  await expectBackendAction(page, action, async () => {
    await page.getByRole('button', { name: 'Reply' }).last().click();
  });
  await expect(page.getByText(text).first()).toBeVisible();
}

async function deleteOwnComment(page: Page, action: 'deleteComment' | 'deleteAnnouncementComment') {
  await expectBackendAction(page, action, async () => {
    await page.getByRole('button', { name: 'Delete' }).last().click();
  });
}

test('proposal covers support, threaded comments, deletion, and terminal outcome writes', async ({ browser }) => {
  test.setTimeout(180_000);
  const owner = await newUserPage(browser, 'ordinary');
  const title = `P ${Date.now().toString().slice(-8)}`;
  const proposalUrl = await createProposal(owner.page, 'proposal-a', title);
  await owner.context.close();

  const member = await newUserPage(browser, 'other');
  await member.page.goto(proposalUrl);
  await member.page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async (url: string) => { (window as typeof window & { __sharedUrl?: string }).__sharedUrl = url; } },
    });
  });
  await member.page.getByRole('button', { name: 'Share proposal' }).click();
  await expect.poll(() => member.page.evaluate(
    () => (window as typeof window & { __sharedUrl?: string }).__sharedUrl,
  )).toBe(proposalUrl);
  const support = member.page.getByRole('button', { name: /Support this proposal|Remove support/u });
  const initialSupport = await support.getAttribute('aria-pressed');
  await expectBackendAction(member.page, initialSupport === 'true' ? 'removeSupport' : 'toggleSupport', async () => support.click());
  await expect(support).toHaveAttribute('aria-pressed', initialSupport === 'true' ? 'false' : 'true');
  await expectBackendAction(member.page, initialSupport === 'true' ? 'toggleSupport' : 'removeSupport', async () => support.click());
  await expect(support).toHaveAttribute('aria-pressed', initialSupport!);

  const rootComment = `Proposal root ${Date.now()}`;
  const reply = `Proposal reply ${Date.now()}`;
  await createComment(member.page, rootComment, 'createComment');
  await replyToComment(member.page, reply, 'createComment');
  await deleteOwnComment(member.page, 'deleteComment');
  await expect(member.page.getByText(reply)).toHaveCount(0);
  await deleteOwnComment(member.page, 'deleteComment');
  await expect(member.page.getByText(rootComment)).toHaveCount(0);
  await member.context.close();

  const manager = await newUserPage(browser, 'issueManager');
  await manager.page.goto(proposalUrl);
  await chooseMoreAction(manager.page, 'Manage status');
  await manager.page.getByRole('combobox', { name: 'Status' }).click();
  await manager.page.getByRole('option', { name: 'Completed' }).click();
  const outcome = `Proposal outcome ${Date.now()}`;
  await manager.page.getByPlaceholder('Explain the outcome or why the proposal is not feasible…').fill(outcome);
  await expectBackendActions(manager.page, ['moderateIssueStatus', 'updateIssueResult'], async () => {
    await manager.page.getByRole('button', { name: 'Submit' }).click();
  });
  await expect(manager.page.getByText('Completed', { exact: true }).first()).toBeVisible();
  await expect(manager.page.getByText(outcome, { exact: true }).first()).toBeVisible();
  await deleteFromMoreActions(manager.page, 'Delete proposal');
  await manager.context.close();
});

test('facility covers affected reaction and terminal outcome write', async ({ browser }) => {
  test.setTimeout(150_000);
  const owner = await newUserPage(browser, 'ordinary');
  const title = `F ${Date.now().toString().slice(-8)}`;
  const facilityUrl = await createFacility(owner.page, 'facility-a', title);
  await owner.context.close();
  const member = await newUserPage(browser, 'other');
  await member.page.goto(facilityUrl);
  const affected = member.page.getByRole('button', { name: /I have this issue too|Remove marker/u });
  const initialAffected = await affected.getAttribute('aria-pressed');
  await expectBackendAction(member.page, 'toggleFacilityAffected', async () => affected.click());
  await expect(affected).toHaveAttribute('aria-pressed', initialAffected === 'true' ? 'false' : 'true');
  await expectBackendAction(member.page, 'toggleFacilityAffected', async () => affected.click());
  await expect(affected).toHaveAttribute('aria-pressed', initialAffected!);
  await member.context.close();

  const manager = await newUserPage(browser, 'facilityManager');
  await manager.page.goto(facilityUrl);
  await chooseMoreAction(manager.page, 'Update status');
  await manager.page.getByRole('combobox', { name: 'Status' }).click();
  await manager.page.getByRole('option', { name: 'Completed' }).click();
  const outcome = `Facility outcome ${Date.now()}`;
  await manager.page.getByPlaceholder('Describe the outcome…').fill(outcome);
  await expectBackendAction(manager.page, 'updateFacilityStatus', async () => {
    await manager.page.getByRole('button', { name: 'Submit' }).click();
  });
  await expect(manager.page.getByText('Completed', { exact: true })).toBeVisible();
  await expect(manager.page.getByText(outcome)).toBeVisible();
  await deleteFromMoreActions(manager.page, 'Delete report');
  await manager.context.close();
});

test('announcement covers like, threaded comments, deletion, and manager removal', async ({ browser }) => {
  test.setTimeout(180_000);
  const manager = await newUserPage(browser, 'announcementManager');
  const title = `A ${Date.now().toString().slice(-8)}`;
  const announcementUrl = await createAnnouncement(manager.page, title);
  await manager.context.close();

  const member = await newUserPage(browser, 'other');
  await member.page.goto(announcementUrl);
  const like = member.page.getByRole('button', { name: /Like announcement|Liked/u });
  const initialLike = await like.getAttribute('aria-pressed');
  await expectBackendAction(member.page, 'setAnnouncementLike', async () => like.click());
  await expect(like).toHaveAttribute('aria-pressed', initialLike === 'true' ? 'false' : 'true');
  await expectBackendAction(member.page, 'setAnnouncementLike', async () => like.click());
  await expect(like).toHaveAttribute('aria-pressed', initialLike!);

  const rootComment = `Announcement root ${Date.now()}`;
  const reply = `Announcement reply ${Date.now()}`;
  await createComment(member.page, rootComment, 'createAnnouncementComment');
  await replyToComment(member.page, reply, 'createAnnouncementComment');
  await deleteOwnComment(member.page, 'deleteAnnouncementComment');
  await expect(member.page.getByText(reply)).toHaveCount(0);
  await deleteOwnComment(member.page, 'deleteAnnouncementComment');
  await expect(member.page.getByText(rootComment)).toHaveCount(0);
  await member.context.close();

  const remover = await newUserPage(browser, 'announcementManager');
  await remover.page.goto(announcementUrl);
  await deleteFromMoreActions(remover.page, 'Delete announcement');
  await remover.context.close();
});
