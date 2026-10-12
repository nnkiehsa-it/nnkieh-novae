import type { IssueReadAccess } from "@/types/categories";

/** Who may read a proposal category, from widest to narrowest. */
export const READ_ACCESS_LEVELS = ["school", "reviewed-school", "owner-admin"] as const satisfies readonly IssueReadAccess[];

export const READ_ACCESS_KEYS: Record<IssueReadAccess, string> = {
  school: "ui.admin.schoolVisible",
  "reviewed-school": "ui.admin.reviewedVisible",
  "owner-admin": "ui.admin.ownerAdminOnly",
};

export function isReadAccess(value: unknown): value is IssueReadAccess {
  return typeof value === "string" && Object.hasOwn(READ_ACCESS_KEYS, value);
}
