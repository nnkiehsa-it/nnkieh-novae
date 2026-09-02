import { expect, type Page } from '@playwright/test';
import { expectBackendAction } from '../support/backend-action';

type Scope =
  | { kind: 'announcement' }
  | { kind: 'facility'; category: string }
  | { kind: 'issue'; category: string };

const scopeButton = {
  announcement: 'Announcement management',
  facility: 'Facility category',
  issue: 'Proposal category',
} as const;

export async function openAccessManagement(page: Page) {
  await page.goto('/admin/management?tab=members');
  await expect(page.getByRole('heading', { name: 'Platform management' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Member access' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
}

export async function selectScope(page: Page, scope: Scope) {
  await page.getByRole('tab', { name: scopeButton[scope.kind] }).click();
  if ('category' in scope) {
    await page.getByRole('combobox').click();
    await page.getByRole('option', { name: scope.category }).click();
  }
  await expect(page.getByText('2. Current owners')).toBeVisible();
}

export async function setMemberAccess(
  page: Page,
  scope: Scope,
  email: string,
  grant: boolean,
) {
  await selectScope(page, scope);
  const lookup = page.getByPlaceholder('Enter a campus email, name, or UID');
  await lookup.fill(email);
  await page.getByRole('button', { name: 'Search' }).click();
  const candidate = page.getByRole('group', { name: email }).last();
  await expect(candidate).toBeVisible();
  const action = candidate.getByRole('button', {
    name: grant ? 'Grant access' : 'Revoke',
  });
  if (!await action.isVisible()) return;
  await expectBackendAction(page, 'setUserAccessScope', async () => action.click());
  await expect(
    candidate.getByRole('button', { name: grant ? 'Revoke' : 'Grant access' }),
  ).toBeVisible();
}
