import { invokeBackendAction } from '@/services/backend-action';
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

async function listAccessUsers(
  payload: { categoryId?: string; query: string; scopeKind?: AccessScope['kind'] },
  options: { onUsers?: (users: AccessUser[]) => void } = {},
) {
  let streamed: AccessUserList = { truncated: false, users: [] };
  const fn = invokeBackendAction<typeof payload, AccessUserList>('listRoleAssignments', {
    onSegment: (key, data) => {
      if (key === 'truncated') streamed = { ...streamed, truncated: data === true };
      if (key !== 'users') return;
      streamed = withoutPlatformAdmins({ ...streamed, users: data as AccessUser[] });
      options.onUsers?.(streamed.users);
    },
  });
  return withoutPlatformAdmins(await fn(payload));
}

export async function listScopeMembers(
  scope: AccessScope,
  options: { onUsers?: (users: AccessUser[]) => void } = {},
) {
  return await listAccessUsers({
    categoryId: 'categoryId' in scope ? scope.categoryId : undefined,
    query: '',
    scopeKind: scope.kind,
  }, options);
}

export async function lookupAccessMember(
  query: string,
  options: { onUsers?: (users: AccessUser[]) => void } = {},
) {
  return await listAccessUsers({ query: query.trim() }, options);
}

export async function setUserAccessScope(
  uid: string,
  scope: AccessScope,
  grant: boolean,
) {
  const fn = invokeBackendAction<
    { categoryId?: string; grant: boolean; scopeKind: AccessScope['kind']; uid: string },
    { success: boolean; roles: RoleCode[]; managedIssueCategoryIds: string[]; managedFacilityCategoryIds: string[] }
  >('setUserAccessScope');
  return await fn({
    categoryId: 'categoryId' in scope ? scope.categoryId : undefined,
    grant,
    scopeKind: scope.kind,
    uid,
  });
}
