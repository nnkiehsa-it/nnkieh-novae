import type * as v from "valibot";
import { isWriteGroup, type ActionSpec, type WriteGroup } from "./contract.ts";
import { FACILITY_ACTIONS } from "./contracts/facilities.ts";
import { UPLOAD_ACTIONS } from "./contracts/uploads.ts";
import { OPERATION_ACTIONS } from "./contracts/operations.ts";
import { SESSION_ACTIONS } from "./contracts/session.ts";
import { CATEGORY_ACTIONS } from "./contracts/categories.ts";
import { USER_ACTIONS } from "./contracts/users.ts";
import { NOTIFICATION_ACTIONS } from "./contracts/notifications.ts";
import { ISSUE_ACTIONS } from "./contracts/issues.ts";
import { ANNOUNCEMENT_ACTIONS } from "./contracts/announcements.ts";

/** Every backend action. The Worker registers exactly these, and the client can call nothing else. */
export const ACTIONS = {
  ...FACILITY_ACTIONS,
  ...UPLOAD_ACTIONS,
  ...OPERATION_ACTIONS,
  ...SESSION_ACTIONS,
  ...CATEGORY_ACTIONS,
  ...USER_ACTIONS,
  ...NOTIFICATION_ACTIONS,
  ...ISSUE_ACTIONS,
  ...ANNOUNCEMENT_ACTIONS,
} satisfies Record<string, ActionSpec>;

export type ActionName = keyof typeof ACTIONS;
export type ActionInput<N extends ActionName> = v.InferOutput<(typeof ACTIONS)[N]["input"]>;
/** What a caller passes: defaults the schema fills in may be left out. */
export type ActionRequest<N extends ActionName> = v.InferInput<(typeof ACTIONS)[N]["input"]>;
export type ActionOutput<N extends ActionName> = v.InferOutput<(typeof ACTIONS)[N]["output"]>;

/** The actions that change something: each runs as a recorded operation and says what it announces. */
export type WriteActionName = { [N in ActionName]: (typeof ACTIONS)[N]["group"] extends WriteGroup ? N : never }[ActionName];

export function isWriteAction(name: ActionName): name is WriteActionName {
  return isWriteGroup(ACTIONS[name].group);
}
