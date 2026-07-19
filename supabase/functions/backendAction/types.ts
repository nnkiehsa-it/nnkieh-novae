import type { AppDatabaseClient } from "../_shared/database-client.ts";

export type BackendSupabase = AppDatabaseClient;
export type JsonRecord = Record<string, unknown>;
export type PermissionCode =
  | "announcement.manage"
  | "category.manage"
  | "dashboard.view"
  | "facility.manage"
  | "proposal.manage"
  | "role.manage";

export interface AuthContext {
  email: string;
  isAdmin: boolean;
  managedIssueCategoryIds: string[];
  managedFacilityCategoryIds: string[];
  permissions: PermissionCode[];
  roles: string[];
  name: string;
  photoUrl: string | null;
  setupCompleted: boolean;
  uid: string;
}
