import type { AdminOverviewWindow } from '@/constants/admin-activity';
import { invokeBackendAction } from '@/services/backend-action';
import type { RoleCode } from '@/services/session-role';

export type { AdminOverviewWindow };
export type RestrictionMode = 'clear' | '7d' | '30d' | 'permanent' | 'custom';

interface AdminUserWire {
  uid: string;
  email: string | null;
  name: string;
  photoUrl: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  restrictedUntil: string | null;
  restrictedPermanently: boolean;
  restrictionReason: string;
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
  restrictedUntil: Date | null;
  restrictedPermanently: boolean;
  restrictionReason: string;
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
      restrictedUntil: toDate(user.restrictedUntil),
      restrictedPermanently: user.restrictedPermanently,
      restrictionReason: user.restrictionReason,
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

export async function setUserRestriction(
  uid: string,
  mode: RestrictionMode,
  reason: string,
  durationHours?: number,
) {
  return await invokeBackendAction<
    { uid: string; mode: RestrictionMode; reason: string; durationHours?: number },
    {
      success: boolean;
      uid: string;
      restrictedUntil: string | null;
      restrictedPermanently: boolean;
    }
  >('setUserRestriction')({
    uid,
    mode,
    reason: reason.trim(),
    ...(mode === 'custom' ? { durationHours } : {}),
  });
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

