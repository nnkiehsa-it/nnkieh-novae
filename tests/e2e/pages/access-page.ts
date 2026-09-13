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
  await page.goto('/admin/people');
  await expect(page.getByRole('heading', { name: 'People and access' })).toBeVisible();
  const byArea = page.getByRole('tab', { name: 'By area' });
  await byArea.click();
  await expect(byArea).toHaveAttribute('aria-selected', 'true');
}

export async function selectScope(page: Page, scope: Scope) {
  const scopeTab = page.getByRole('tab', { name: scopeButton[scope.kind] });
  await scopeTab.click();
  await expect(scopeTab).toHaveAttribute('aria-selected', 'true');
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
  // Granting and revoking edit the draft; only Save reaches the backend.
  const row = page
    .getByRole('button', {
      name: new RegExp(`${email}[^]*${grant ? 'Grant access' : 'Revoke'}`, 'u'),
    })
    .last();
  await expect(row).toBeVisible();
  await row.click();
  await expectBackendAction(page, 'setUserAccessScope', async () => {
    await page.getByRole('button', { name: 'Save', exact: true }).click();
  });
  await expect(page.getByText('unsaved changes')).toHaveCount(0);
}
