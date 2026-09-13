export interface AdminAccess {
  admin: boolean;
  categories: boolean;
  members: boolean;
  overview: boolean;
}

export type AdminGroup = "content" | "people" | "system";

export interface AdminRoute {
  allowed: (access: AdminAccess) => boolean;
  detailKey: string;
  group: AdminGroup;
  href: string;
  labelKey: string;
}

/**
 * The administration areas, one responsibility each.
 *
 * Each row is a route rather than a tab because each one is saved on its own:
 * retention and upload limits share a single stored value and so share a
 * screen, while runtime policies are written by a different action under a
 * different permission and so cannot. Splitting them is what lets a screen have
 * exactly one Save.
 *
 * This table holds no JSX so that route preloading can read it without a hook
 * reaching into a component.
 */
export const ADMIN_ROUTES: readonly AdminRoute[] = [
  {
    allowed: (access) => access.categories,
    detailKey: "admin.contentDetail",
    group: "content",
    href: "/admin/content",
    labelKey: "admin.contentTitle",
  },
  {
    allowed: (access) => access.categories,
    detailKey: "admin.platformDetail",
    group: "content",
    href: "/admin/platform",
    labelKey: "admin.platformTitle",
  },
  {
    allowed: (access) => access.members,
    detailKey: "admin.peopleDetail",
    group: "people",
    href: "/admin/people",
    labelKey: "admin.peopleTitle",
  },
  {
    allowed: (access) => access.members,
    detailKey: "admin.auditDetail",
    group: "people",
    href: "/admin/audit",
    labelKey: "admin.auditTitle",
  },
  {
    allowed: (access) => access.admin,
    detailKey: "admin.systemDetail",
    group: "system",
    href: "/admin/system",
    labelKey: "admin.systemTitle",
  },
  {
    allowed: (access) => access.admin,
    detailKey: "admin.policiesDetail",
    group: "system",
    href: "/admin/policies",
    labelKey: "admin.policiesTitle",
  },
];

export const ADMIN_GROUPS: readonly AdminGroup[] = ["content", "people", "system"];

export function allowedAdminRoutes(access: AdminAccess) {
  return ADMIN_ROUTES.filter((route) => route.allowed(access));
}

/** Whether this reader has any business in the administration area at all. */
export function canEnterAdministration(access: AdminAccess) {
  return access.overview || allowedAdminRoutes(access).length > 0;
}
