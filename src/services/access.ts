import { invokeBackendAction } from '@/services/backend-action';
import { createRequestId } from '@/lib/request-id';
import type { RoleCode } from '@/services/session-role';

export interface AccessUser {
  uid: string;
  email: string | null;
  name: string;
  photoUrl: string | null;
  roles: RoleCode[];
  managedIssueCategoryIds: string[];
  managedFacilityCategoryIds: string[];
}

export type AccessScope =
  | { kind: 'announcement' }
  | { kind: 'facility' | 'issue'; categoryId: string };

interface AccessUserList {
  truncated: boolean;
  users: AccessUser[];
}

function withoutPlatformAdmins(result: AccessUserList): AccessUserList {
  return {
    truncated: result.truncated,
    users: result.users.filter((user) => !user.roles.includes('platform-admin')),
  };
}

export async function listScopeMembers(scope: AccessScope) {
  const fn = invokeBackendAction<
    { categoryId?: string; query: string; scopeKind: AccessScope['kind'] },
    AccessUserList
  >('listRoleAssignments');
  return withoutPlatformAdmins(await fn({
    categoryId: 'categoryId' in scope ? scope.categoryId : undefined,
    query: '',
    scopeKind: scope.kind,
  }));
}

export async function lookupAccessMember(query: string) {
  const fn = invokeBackendAction<
    { query: string },
    AccessUserList
  >('listRoleAssignments');
  return withoutPlatformAdmins(await fn({ query: query.trim() }));
}

export async function setUserAccessScope(
  uid: string,
  scope: AccessScope,
  grant: boolean,
) {
  const fn = invokeBackendAction<
    { categoryId?: string; grant: boolean; requestId: string; scopeKind: AccessScope['kind']; uid: string },
    { success: boolean; roles: RoleCode[]; managedIssueCategoryIds: string[]; managedFacilityCategoryIds: string[] }
  >('setUserAccessScope');
  return await fn({
    categoryId: 'categoryId' in scope ? scope.categoryId : undefined,
    grant,
    requestId: createRequestId(),
    scopeKind: scope.kind,
    uid,
  });
}
