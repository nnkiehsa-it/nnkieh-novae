import * as v from "valibot";
import { action, NoInput } from "../contract.ts";
import { CategoryCatalog } from "./categories.ts";
import { PolicySnapshot } from "./operations.ts";
import { SessionAccess } from "./users.ts";

const Version = v.pipe(v.number(), v.integer(), v.minValue(1));

/** A counter per content domain that moves whenever something in it changes. */
export const ContentVersions = v.object({ announcements: Version, facilities: Version, issues: Version });
export type ContentVersions = v.InferOutput<typeof ContentVersions>;
export type ContentVersionDomain = keyof ContentVersions;

export const SessionBootstrap = v.object({
  runtimePolicies: PolicySnapshot,
  access: SessionAccess,
  catalog: CategoryCatalog,
  notificationUnread: v.object({ hasUnread: v.boolean() }),
  runtime: v.object({ pushTokenConfirmationDays: v.pipe(v.number(), v.integer(), v.minValue(1)) }),
  versions: ContentVersions,
  visitRecorded: v.boolean(),
});
export type SessionBootstrap = v.InferOutput<typeof SessionBootstrap>;

export const SESSION_ACTIONS = {
  getSessionBootstrap: action({
    group: "read",
    input: v.object({ recordVisit: v.optional(v.boolean(), false) }),
    output: SessionBootstrap,
  }),
  getContentVersions: action({ group: "read", input: NoInput, output: v.object({ versions: ContentVersions }) }),
};
