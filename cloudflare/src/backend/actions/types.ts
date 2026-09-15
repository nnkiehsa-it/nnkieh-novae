import type { DatabaseSession } from "../database/client.ts";

export type BackendDatabase = DatabaseSession;

/**
 * One piece of an answer. A `key` names the field it fills in on the result;
 * a segment without one is the whole result, which is what an action that has
 * nothing to divide produces.
 */
export interface ActionSegment { data: unknown; key?: string }

/** What an action hands back: a finished answer, or one arriving in pieces. */
export type ActionResult = unknown | AsyncIterable<ActionSegment>;
export type JsonRecord = Record<string, unknown>;
export type PermissionCode =
  | "announcement.manage"
  | "category.manage"
  | "dashboard.view"
  | "facility.manage"
  | "proposal.manage"
  | "role.manage";

export interface AuthContext {
  accessPreset: "read_only" | "reaction_only" | null;
  accessRestrictionMessage: string;
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
