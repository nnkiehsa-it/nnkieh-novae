import { expect, type Page } from '@playwright/test';

type Scope =
  | { kind: 'announcement' }
  | { kind: 'facility'; category: string }
  | { kind: 'issue'; category: string };

const scopeButton = {
  announcement: 'Announcement management',
  facility: 'Facility-report responsibilities',
  issue: 'Proposal responsibilities',
} as const;

export async function openAccessManagement(page: Page) {
  await page.goto('/admin/management?tab=members');
  await expect(page.getByRole('heading', { name: 'People and permissions' })).toBeVisible();
}

export async function selectScope(page: Page, scope: Scope) {
  await page.getByRole('button', { name: new RegExp(scopeButton[scope.kind], 'i') }).click();
  if ('category' in scope) {
    await page.getByRole('button', { name: new RegExp(scope.category, 'i') }).click();
  }
  await expect(page.getByRole('heading', { name: 'People with this permission' })).toBeVisible();
}

export async function setMemberAccess(
  page: Page,
  scope: Scope,
  email: string,
  grant: boolean,
) {
  await selectScope(page, scope);
  const lookup = page.getByPlaceholder('Full email or UID');
  await lookup.fill(email);
  await page.getByRole('button', { name: 'Look up' }).click();
  const candidateEmail = page.getByText(email, { exact: true }).last();
  await expect(candidateEmail).toBeVisible();
  const candidate = candidateEmail.locator('..').locator('..');
  const action = candidate.getByRole('button', {
    name: grant ? 'Grant permission' : 'Remove permission',
  });
  if (!await action.isVisible()) return;
  await action.click();
  await expect(page.getByText('Management access updated')).toBeVisible();
}
