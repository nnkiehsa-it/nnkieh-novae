import type { PermissionCode, RoleCode, SessionAccess } from '@/services/session-role';

export type SessionAccessPolicy = Pick<
  SessionAccess,
  'managedFacilityCategoryIds' | 'managedIssueCategoryIds' | 'permissions' | 'roles'
>;

export function hasRole(access: Pick<SessionAccessPolicy, 'roles'>, role: RoleCode) {
  return access.roles.includes(role);
}

export function hasPermission(
  access: Pick<SessionAccessPolicy, 'permissions'>,
  permission: PermissionCode,
) {
  return access.permissions.includes(permission);
}

export function canManageIssueCategory(
  access: Pick<SessionAccessPolicy, 'managedIssueCategoryIds' | 'roles'>,
  categoryId: string,
) {
  return hasRole(access, 'platform-admin')
    || access.managedIssueCategoryIds.includes(categoryId);
}

export function canManageFacilityCategory(
  access: Pick<SessionAccessPolicy, 'managedFacilityCategoryIds' | 'roles'>,
  categoryId: string,
) {
  return hasRole(access, 'platform-admin')
    || access.managedFacilityCategoryIds.includes(categoryId);
}
