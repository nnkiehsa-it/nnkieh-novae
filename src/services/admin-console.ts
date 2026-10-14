import type { ActionRequest } from '@shared/actions.ts';
import type { AccountAccessTargetType, AdminActivityCursor, AdminOverviewWindow } from '@shared/contracts/users.ts';
import { callAction } from '@/services/backend-action';

export type {
  AccountAccessDuration,
  AccountAccessPreset,
  AccountAccessRule,
  AccountAccessTargetType,
  AdminActivity as AdminOverviewActivity,
  AdminActivityCursor,
  AdminAuditEntry,
  AdminOverview as AdminOverviewData,
  AdminOverviewWindow,
  AdminUser,
} from '@shared/contracts/users.ts';

export type AccountAccessRuleInput = ActionRequest<'saveAccountAccessRule'>;

export function fetchAdminOverview(window: AdminOverviewWindow) {
  return callAction('getAdminOverview', { window });
}

export function listAdminActivity(window: AdminOverviewWindow, cursor: AdminActivityCursor | null = null) {
  return callAction('listAdminActivity', { cursor, window });
}

export function listAdminUsers(query = '', page = 0) {
  return callAction('listAdminUsers', { query, page });
}

export async function listAccountAccessRules() {
  return (await callAction('listAccountAccessRules', {})).rules;
}

export function previewAccountAccessRule(input: AccountAccessRuleInput) {
  return callAction('previewAccountAccessRule', input);
}

export function saveAccountAccessRule(input: AccountAccessRuleInput) {
  return callAction('saveAccountAccessRule', input);
}

export function deleteAccountAccessRule(
  targetType: AccountAccessTargetType,
  targetValue: string,
  revision: string | null,
) {
  return callAction('deleteAccountAccessRule', { targetType, targetValue, revision });
}

export function listAdminAudit(query = '', page = 0) {
  return callAction('listAdminAudit', { query, page });
}
