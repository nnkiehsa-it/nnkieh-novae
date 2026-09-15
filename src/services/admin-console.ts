import type { AdminOverviewWindow } from '@/constants/admin-activity';
import { invokeBackendAction } from '@/services/backend-action';
import type { RoleCode } from '@/services/session-role';

export type { AdminOverviewWindow };
export type AccountAccessPreset = 'read_only' | 'reaction_only' | 'blocked';
export type AccountAccessDuration = '7d' | '30d' | 'custom' | 'permanent';
export type AccountAccessTargetType = 'uid' | 'email_prefix';

export interface AccountAccessRule {
  expiresAt: Date | null;
  matchCount: number;
  message: string;
  permanent: boolean;
  preset: AccountAccessPreset;
  targetType: AccountAccessTargetType;
  targetValue: string;
  updatedAt: Date;
}

interface AccountAccessRuleWire extends Omit<AccountAccessRule, 'expiresAt' | 'updatedAt'> {
  expiresAt: string | null;
  updatedAt: string;
}

interface AdminUserWire {
  uid: string;
  email: string | null;
  name: string;
  photoUrl: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  accessRule: AccountAccessRuleWire | null;
  roles: RoleCode[];
  managedIssueCategoryIds: string[];
  managedFacilityCategoryIds: string[];
}

export interface AdminUser {
  uid: string;
  email: string | null;
  name: string;
  photoUrl: string | null;
  createdAt: Date;
  lastSeenAt: Date | null;
  accessRule: AccountAccessRule | null;
  roles: RoleCode[];
  managedIssueCategoryIds: string[];
  managedFacilityCategoryIds: string[];
}

export interface AdminOverviewActivity {
  kind: 'registration' | 'issue' | 'facility' | 'announcement' | 'admin' | string;
  target_id: string;
  title: string;
  actor_uid: string;
  occurred_at: string;
}

export interface AdminActivityCursor {
  occurredAt: string;
  key: string;
}

export interface AdminOverviewData {
  windowHours: number;
  totalUsers: number;
  activeUsers24h: number;
  activeUsers7d: number;
  activeUsers30d: number;
  newUsers: number;
  newIssues: number;
  newComments: number;
  newFacilities: number;
  newAnnouncements: number;
  openIssues: number;
  openFacilities: number;
  recentActivity: AdminOverviewActivity[];
}

export interface AdminAuditEntry {
  id: number;
  actorUid: string;
  actorName: string;
  action: string;
  domain: string;
  targetId: string | null;
  detail: Record<string, unknown>;
  createdAt: Date;
}

function toDate(value: string | null) {
  return value ? new Date(value) : null;
}

function normalizeActivity(activity: Record<string, unknown>): AdminOverviewActivity {
  return {
    actor_uid: String(activity.actorUid ?? ''),
    kind: String(activity.kind ?? ''),
    occurred_at: String(activity.occurredAt ?? ''),
    target_id: String(activity.targetId ?? ''),
    title: String(activity.title ?? ''),
  };
}

export async function fetchAdminOverview(window: AdminOverviewWindow) {
  const result = await invokeBackendAction<
    { window: AdminOverviewWindow },
    Omit<AdminOverviewData, 'recentActivity'> & { recentActivity: Record<string, unknown>[] }
  >(
    'getAdminOverview',
  )({ window });
  return { ...result, recentActivity: result.recentActivity.map(normalizeActivity) };
}

export async function listAdminActivity(
  window: AdminOverviewWindow,
  cursor: AdminActivityCursor | null = null,
) {
  const result = await invokeBackendAction<
    { window: AdminOverviewWindow; cursor: AdminActivityCursor | null },
    { entries: Record<string, unknown>[]; nextCursor: AdminActivityCursor | null }
  >('listAdminActivity')({ cursor, window });
  return { ...result, entries: result.entries.map(normalizeActivity) };
}

export async function listAdminUsers(query = '', page = 0) {
  const result = await invokeBackendAction<
    { query: string; page: number },
    { truncated: boolean; users: AdminUserWire[] }
  >('listAdminUsers')({ query: query.trim(), page });

  return {
    truncated: result.truncated,
    users: result.users.map((user) => ({
      uid: user.uid,
      email: user.email,
      name: user.name,
      photoUrl: user.photoUrl,
      createdAt: new Date(user.createdAt),
      lastSeenAt: toDate(user.lastSeenAt),
      accessRule: user.accessRule ? normalizeAccessRule(user.accessRule) : null,
      roles: Array.isArray(user.roles) ? user.roles : [],
      managedIssueCategoryIds: Array.isArray(user.managedIssueCategoryIds)
        ? user.managedIssueCategoryIds
        : [],
      managedFacilityCategoryIds: Array.isArray(user.managedFacilityCategoryIds)
        ? user.managedFacilityCategoryIds
        : [],
    })),
  };
}

function normalizeAccessRule(rule: AccountAccessRuleWire): AccountAccessRule {
  return {
    ...rule,
    expiresAt: toDate(rule.expiresAt),
    updatedAt: new Date(rule.updatedAt),
  };
}

export async function listAccountAccessRules() {
  const result = await invokeBackendAction<Record<string, never>, { rules: AccountAccessRuleWire[] }>(
    'listAccountAccessRules',
  )({});
  return result.rules.map(normalizeAccessRule);
}

export async function saveAccountAccessRule(input: {
  duration: AccountAccessDuration;
  durationHours?: number;
  message: string;
  preset: AccountAccessPreset;
  targetType: AccountAccessTargetType;
  targetValue: string;
}) {
  return await invokeBackendAction<
    typeof input,
    { success: boolean }
  >('saveAccountAccessRule')({ ...input, message: input.message.trim(), targetValue: input.targetValue.trim() });
}

export async function deleteAccountAccessRule(
  targetType: AccountAccessTargetType,
  targetValue: string,
) {
  return await invokeBackendAction<
    { targetType: AccountAccessTargetType; targetValue: string },
    { success: boolean }
  >('deleteAccountAccessRule')({ targetType, targetValue });
}

export async function listAdminAudit(query = '', page = 0) {
  const result = await invokeBackendAction<
    { query: string; page: number },
    {
      truncated: boolean;
      entries: Array<Omit<AdminAuditEntry, 'createdAt'> & { createdAt: string }>;
    }
  >('listAdminAudit')({ query: query.trim(), page });

  return {
    truncated: result.truncated,
    entries: result.entries.map(({ createdAt, ...entry }) => ({
      ...entry,
      createdAt: new Date(createdAt),
    })),
  };
}
