import * as v from "valibot";
import { action, Count, NoInput, NullableTimestamp, RequiredText, Text, Timestamp } from "../contract.ts";

export const RoleCode = v.picklist(["platform-admin", "proposal-manager", "announcement-manager", "general-affairs"]);
export type RoleCode = v.InferOutput<typeof RoleCode>;

export const PermissionCode = v.picklist([
  "proposal.manage",
  "announcement.manage",
  "category.manage",
  "facility.manage",
  "role.manage",
  "dashboard.view",
]);
export type PermissionCode = v.InferOutput<typeof PermissionCode>;

const CategoryIds = v.array(v.string());

/** What the signed-in account may do. */
export const SessionAccess = v.object({
  role: v.picklist(["admin", "user"]),
  roles: v.array(RoleCode),
  permissions: v.array(PermissionCode),
  managedIssueCategoryIds: CategoryIds,
  managedFacilityCategoryIds: CategoryIds,
  setupCompleted: v.boolean(),
});
export type SessionAccess = v.InferOutput<typeof SessionAccess>;

export const UserPublicProfile = v.object({
  uid: v.string(),
  displayName: v.nullable(v.string()),
  photoUrl: v.nullable(v.string()),
  version: Count,
});
export type UserPublicProfile = v.InferOutput<typeof UserPublicProfile>;

/** An account as the access screens list it. */
export const AccessUser = v.object({
  uid: v.string(),
  email: v.nullable(v.string()),
  name: v.string(),
  photoUrl: v.nullable(v.string()),
  roles: v.array(RoleCode),
  managedIssueCategoryIds: CategoryIds,
  managedFacilityCategoryIds: CategoryIds,
});
export type AccessUser = v.InferOutput<typeof AccessUser>;

export const AccessScopeKind = v.picklist(["announcement", "facility", "issue"]);
export type AccessScopeKind = v.InferOutput<typeof AccessScopeKind>;

/** Announcements are one scope; issues and facilities are scoped per category. */
const AccessScope = v.variant("scopeKind", [
  v.object({ scopeKind: v.literal("announcement"), categoryId: v.optional(v.never("validation-invalid")) }),
  v.object({ scopeKind: v.picklist(["facility", "issue"]), categoryId: RequiredText }),
], "validation-required");

const MembershipRevision = v.pipe(v.string(), v.regex(/^[a-f0-9]{32}$/u, "validation-required"));

export const AccountAccessPreset = v.picklist(["read_only", "reaction_only", "blocked"]);
export type AccountAccessPreset = v.InferOutput<typeof AccountAccessPreset>;
export const AccountAccessTargetType = v.picklist(["uid", "email_prefix"]);
export type AccountAccessTargetType = v.InferOutput<typeof AccountAccessTargetType>;
export const AccountAccessDuration = v.picklist(["keep", "7d", "30d", "custom", "permanent"]);
export type AccountAccessDuration = v.InferOutput<typeof AccountAccessDuration>;

export const AccountAccessRule = v.object({
  active: v.boolean(),
  expiresAt: NullableTimestamp,
  matchCount: Count,
  message: v.string(),
  permanent: v.boolean(),
  preset: AccountAccessPreset,
  revision: v.string(),
  targetType: AccountAccessTargetType,
  targetValue: v.string(),
  updatedAt: Timestamp,
});
export type AccountAccessRule = v.InferOutput<typeof AccountAccessRule>;

const RuleRevision = v.nullable(MembershipRevision);
const RuleTarget = { targetType: AccountAccessTargetType, targetValue: RequiredText, revision: RuleRevision };

/** A rule as an administrator writes it; the Worker checks the combinations. */
const RuleDraft = v.object({
  ...RuleTarget,
  preset: AccountAccessPreset,
  duration: AccountAccessDuration,
  durationHours: v.optional(v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(87_600))),
  message: v.pipe(RequiredText, v.maxLength(500, "validation-invalid")),
});

const RuleChange = v.object({
  deleted: v.boolean(),
  effectiveRule: v.nullable(AccountAccessRule),
  revision: v.nullable(v.string()),
  rule: v.nullable(AccountAccessRule),
  success: v.literal(true),
  targetType: AccountAccessTargetType,
  targetValue: v.string(),
});

export const AdminUser = v.object({
  ...AccessUser.entries,
  createdAt: Timestamp,
  lastSeenAt: NullableTimestamp,
  accessRule: v.nullable(AccountAccessRule),
  accessRuleRevision: v.nullable(v.string()),
});
export type AdminUser = v.InferOutput<typeof AdminUser>;

export const AdminAuditEntry = v.object({
  id: Count,
  actorUid: v.string(),
  actorName: v.string(),
  action: v.string(),
  domain: v.string(),
  targetId: v.nullable(v.string()),
  detail: v.record(v.string(), v.unknown()),
  createdAt: Timestamp,
});
export type AdminAuditEntry = v.InferOutput<typeof AdminAuditEntry>;

export const AdminOverviewWindow = v.picklist(["24h", "7d", "30d"]);
export type AdminOverviewWindow = v.InferOutput<typeof AdminOverviewWindow>;

export const AdminActivity = v.object({
  kind: v.picklist(["registration", "issue", "comment", "facility", "announcement", "admin"]),
  targetId: v.string(),
  title: v.string(),
  actorUid: v.string(),
  occurredAt: Timestamp,
});
export type AdminActivity = v.InferOutput<typeof AdminActivity>;

export const AdminActivityCursor = v.object({ occurredAt: Timestamp, key: v.string() });
export type AdminActivityCursor = v.InferOutput<typeof AdminActivityCursor>;

export const AdminOverview = v.object({
  windowHours: Count,
  totalUsers: Count,
  activeUsers24h: Count,
  activeUsers7d: Count,
  activeUsers30d: Count,
  newUsers: Count,
  newIssues: Count,
  newComments: Count,
  newFacilities: Count,
  newAnnouncements: Count,
  openIssues: Count,
  openFacilities: Count,
  recentActivity: v.array(AdminActivity),
});
export type AdminOverview = v.InferOutput<typeof AdminOverview>;

const AdminPage = v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)), 0);
const AdminSearch = v.optional(v.pipe(Text, v.maxLength(120, "validation-too-long")), "");

export const USER_ACTIONS = {
  getCurrentUserRole: action({ group: "read", input: NoInput, output: SessionAccess }),
  getUserPublicProfiles: action({
    group: "read",
    input: v.object({ uids: v.pipe(v.array(RequiredText), v.maxLength(50)) }),
    output: v.object({ profiles: v.record(v.string(), UserPublicProfile) }),
  }),
  cacheUserAvatar: action({
    group: "sensitive-write",
    extraLimit: "avatarCacheDaily",
    input: NoInput,
    output: v.object({ photoUrl: v.nullable(v.string()) }),
  }),
  listRoleAssignments: action({
    group: "read",
    input: v.union([
      v.object({ query: RequiredText }),
      v.intersect([v.object({ query: v.literal("") }), AccessScope]),
    ], "validation-required"),
    output: v.object({ truncated: v.boolean(), revision: v.string(), users: v.array(AccessUser) }),
  }),
  saveScopeMembers: action({
    group: "admin-write",
    extraLimit: "roleWriteHourly",
    units: (input) => input.changes.length,
    input: v.intersect([
      v.object({
        revision: MembershipRevision,
        changes: v.pipe(
          v.array(v.object({ uid: RequiredText, grant: v.boolean() })),
          v.minLength(1, "validation-required"),
          v.check((changes) => new Set(changes.map((change) => change.uid)).size === changes.length, "validation-required"),
        ),
      }),
      AccessScope,
    ]),
    output: v.object({
      changedUids: v.array(v.string()),
      revision: v.string(),
      success: v.literal(true),
      users: v.array(AccessUser),
    }),
  }),
  listAdminUsers: action({
    group: "read",
    input: v.object({ query: AdminSearch, page: AdminPage }),
    output: v.object({ truncated: v.boolean(), users: v.array(AdminUser) }),
  }),
  listAdminAudit: action({
    group: "read",
    input: v.object({ query: AdminSearch, page: AdminPage }),
    output: v.object({ truncated: v.boolean(), entries: v.array(AdminAuditEntry) }),
  }),
  listAdminActivity: action({
    group: "read",
    input: v.object({ window: v.optional(AdminOverviewWindow, "24h"), cursor: v.optional(v.nullable(AdminActivityCursor), null) }),
    output: v.object({ entries: v.array(AdminActivity), nextCursor: v.nullable(AdminActivityCursor) }),
  }),
  getAdminOverview: action({
    group: "read",
    input: v.object({ window: v.optional(AdminOverviewWindow, "24h") }),
    output: AdminOverview,
  }),
  listAccountAccessRules: action({
    group: "read",
    input: NoInput,
    output: v.object({ rules: v.array(AccountAccessRule) }),
  }),
  previewAccountAccessRule: action({
    group: "read",
    input: RuleDraft,
    output: v.object({ matchingCount: Count, targetValue: v.string() }),
  }),
  saveAccountAccessRule: action({
    group: "admin-write",
    extraLimit: "moderationWriteHourly",
    input: RuleDraft,
    output: RuleChange,
  }),
  deleteAccountAccessRule: action({
    group: "admin-write",
    extraLimit: "moderationWriteHourly",
    input: v.object(RuleTarget),
    output: RuleChange,
  }),
};

