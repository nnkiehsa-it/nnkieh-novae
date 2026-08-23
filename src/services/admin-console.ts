import { createRequestId } from '@/lib/request-id';
import { invokeBackendAction } from '@/services/backend-action';
import type { RoleCode } from '@/services/session-role';

export type AdminOverviewWindow = '24h' | '7d' | '30d';
export type RestrictionMode = 'clear' | '7d' | '30d' | 'permanent';

interface AdminUserWire {
  uid: string;
  email: string | null;
  name: string;
  createdAtMs: number;
  lastSeenAtMs: number | null;
  restrictedUntilMs: number | null;
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

interface DeletionJobWire {
  id: string;
  targetType: string;
  targetId: string;
  cloudinaryPublicId: string | null;
  status: string;
  attemptCount: number;
  nextAttemptAtMs: number;
  errorTraceId: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface DeletionJob extends Omit<DeletionJobWire, 'createdAtMs' | 'nextAttemptAtMs' | 'updatedAtMs'> {
  createdAt: Date;
  nextAttemptAt: Date;
  updatedAt: Date;
}

function toDate(value: number | null) {
  return typeof value === 'number' ? new Date(value) : null;
}

export async function fetchAdminOverview(window: AdminOverviewWindow) {
  return await invokeBackendAction<{ window: AdminOverviewWindow }, AdminOverviewData>(
    'getAdminOverview',
  )({ window });
}

export async function listAdminActivity(
  window: AdminOverviewWindow,
  cursor: AdminActivityCursor | null = null,
) {
  return await invokeBackendAction<
    { window: AdminOverviewWindow; cursor: AdminActivityCursor | null },
    { entries: AdminOverviewActivity[]; nextCursor: AdminActivityCursor | null }
  >('listAdminActivity')({ cursor, window });
}

export async function listAdminUsers(query = '') {
  const result = await invokeBackendAction<
    { query: string },
    { truncated: boolean; users: AdminUserWire[] }
  >('listAdminUsers')({ query: query.trim() });

  return {
    truncated: result.truncated,
    users: result.users.map((user) => ({
      uid: user.uid,
      email: user.email,
      name: user.name,
      createdAt: new Date(user.createdAtMs),
      lastSeenAt: toDate(user.lastSeenAtMs),
      restrictedUntil: toDate(user.restrictedUntilMs),
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
) {
  return await invokeBackendAction<
    { uid: string; mode: RestrictionMode; reason: string; requestId: string },
    {
      success: boolean;
      uid: string;
      restrictedUntilMs: number | null;
      restrictedPermanently: boolean;
    }
  >('setUserRestriction')({
    uid,
    mode,
    reason: reason.trim(),
    requestId: createRequestId(),
  });
}

export async function listAdminAudit(query = '') {
  const result = await invokeBackendAction<
    { query: string },
    {
      truncated: boolean;
      entries: Array<Omit<AdminAuditEntry, 'createdAt'> & { createdAtMs: number }>;
    }
  >('listAdminAudit')({ query: query.trim() });

  return {
    truncated: result.truncated,
    entries: result.entries.map(({ createdAtMs, ...entry }) => ({
      ...entry,
      createdAt: new Date(createdAtMs),
    })),
  };
}

export async function listDeletionJobs() {
  const result = await invokeBackendAction<Record<string, never>, { entries: DeletionJobWire[] }>(
    'listDeletionJobs',
  )({});
  return result.entries.map(({ createdAtMs, nextAttemptAtMs, updatedAtMs, ...entry }) => ({
    ...entry,
    createdAt: new Date(createdAtMs),
    nextAttemptAt: new Date(nextAttemptAtMs),
    updatedAt: new Date(updatedAtMs),
  }));
}

export async function retryDeletionJob(jobId: string) {
  return await invokeBackendAction<
    { jobId: string; requestId: string },
    { id: string; queuedAtMs: number; status: 'pending' }
  >('retryDeletionJob')({ jobId, requestId: createRequestId() });
}
