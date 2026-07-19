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

export async function listRoleAssignments(query = '') {
  const fn = invokeBackendAction<{ query: string }, { users: AccessUser[] }>('listRoleAssignments');
  return (await fn({ query })).users;
}

export async function setUserRoles(
  uid: string,
  roles: RoleCode[],
  managedIssueCategoryIds: string[],
  managedFacilityCategoryIds: string[],
) {
  const fn = invokeBackendAction<
    { uid: string; roles: RoleCode[]; managedIssueCategoryIds: string[]; managedFacilityCategoryIds: string[]; requestId: string },
    { success: boolean; roles: RoleCode[]; managedIssueCategoryIds: string[]; managedFacilityCategoryIds: string[] }
  >('setUserRoles');
  return await fn({ uid, roles, managedIssueCategoryIds, managedFacilityCategoryIds, requestId: createRequestId() });
}
