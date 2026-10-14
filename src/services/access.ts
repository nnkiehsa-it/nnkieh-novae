import type { ActionOutput } from '@shared/actions.ts';
import type { AccessUser } from '@shared/contracts/users.ts';
import { callAction } from '@/services/backend-action';

export type { AccessUser } from '@shared/contracts/users.ts';

export type AccessScope =
  | { kind: 'announcement' }
  | { kind: 'facility' | 'issue'; categoryId: string };

type AccessUserList = ActionOutput<'listRoleAssignments'>;

export function accessScopeKey(scope: AccessScope | null) {
  if (!scope) return "admin-access:none";
  return scope.kind === "announcement" ? "admin-access:announcement" : `admin-access:${scope.kind}:${scope.categoryId}`;
}

function scopeRequest(scope: AccessScope) {
  return scope.kind === 'announcement'
    ? { scopeKind: scope.kind }
    : { scopeKind: scope.kind, categoryId: scope.categoryId };
}

function withoutPlatformAdmins(users: AccessUser[]) {
  return users.filter((user) => !user.roles.includes('platform-admin'));
}

/** The answer arrives in parts; the member list is handed over as soon as it lands. */
function streamedUsers(onUsers: ((users: AccessUser[]) => void) | undefined, scoped: boolean) {
  return (key: string | undefined, data: unknown) => {
    if (key !== 'users') return;
    const users = data as AccessUser[];
    onUsers?.(scoped ? withoutPlatformAdmins(users) : users);
  };
}

export async function listScopeMembers(
  scope: AccessScope,
  options: { onUsers?: (users: AccessUser[]) => void } = {},
): Promise<AccessUserList> {
  const result = await callAction('listRoleAssignments', { query: '', ...scopeRequest(scope) }, {
    onSegment: streamedUsers(options.onUsers, true),
  });
  return { ...result, users: withoutPlatformAdmins(result.users) };
}

export async function lookupAccessMember(
  query: string,
  options: { onUsers?: (users: AccessUser[]) => void } = {},
): Promise<AccessUserList> {
  return await callAction('listRoleAssignments', { query: query.trim() }, {
    onSegment: streamedUsers(options.onUsers, false),
  });
}

export async function saveScopeMembers(scope: AccessScope, changes: Array<{ uid: string; grant: boolean }>, revision: string) {
  return await callAction('saveScopeMembers', { ...scopeRequest(scope), changes, revision });
}
