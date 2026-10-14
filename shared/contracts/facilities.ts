import * as v from "valibot";
import { action, Count, NullableTimestamp, OptionalText, pageSize, RequiredText, Success, Text, Timestamp, Uuid } from "../contract.ts";

import { FacilityStatus } from "./statuses.ts";

export { FACILITY_STATUSES, FacilityStatus } from "./statuses.ts";

export const FacilitySort = v.picklist(["latest", "most-affected"]);
export type FacilitySort = v.InferOutput<typeof FacilitySort>;

/** A report as a list shows it. */
export const FacilitySummary = v.object({
  id: Uuid,
  categoryId: v.string(),
  title: v.string(),
  location: v.string(),
  status: FacilityStatus,
  affectedCount: Count,
  authorUid: v.string(),
  createdAt: Timestamp,
  updatedAt: Timestamp,
  isOwnFacility: v.boolean(),
  currentUserAffected: v.boolean(),
  canManageFacility: v.boolean(),
});
export type FacilitySummary = v.InferOutput<typeof FacilitySummary>;

/** A report as its own page shows it. */
export const Facility = v.object({
  ...FacilitySummary.entries,
  content: v.string(),
  resultContent: v.nullable(v.string()),
  startedAt: NullableTimestamp,
  closedAt: NullableTimestamp,
  canDeleteFacility: v.boolean(),
});
export type Facility = v.InferOutput<typeof Facility>;

export const FacilityCursor = v.object({ id: Uuid, createdAt: Timestamp, affectedCount: Count });
export type FacilityCursor = v.InferOutput<typeof FacilityCursor>;

export const FacilityStatusCounts = v.object({
  pending: Count,
  processing: Count,
  completed: Count,
  "unable-to-handle": Count,
});
export type FacilityStatusCounts = v.InferOutput<typeof FacilityStatusCounts>;

const FacilityTarget = v.object({ facilityId: Uuid });

export const FACILITY_ACTIONS = {
  listFacilities: action({
    group: "read",
    input: v.object({
      categoryId: RequiredText,
      bucket: v.optional(v.picklist(["active", "closed"]), "active"),
      status: v.optional(v.union([FacilityStatus, v.literal("")]), ""),
      query: OptionalText,
      sort: v.optional(FacilitySort, "latest"),
      cursor: v.optional(v.nullable(FacilityCursor), null),
      pageSize: pageSize(50, 20),
    }),
    output: v.object({
      facilities: v.array(FacilitySummary),
      hasMore: v.boolean(),
      cursor: v.nullable(FacilityCursor),
      /** Counted for the first page only; a later page leaves the counts it was opened with in place. */
      statusCounts: v.nullable(FacilityStatusCounts),
      version: Count,
    }),
  }),
  getFacility: action({
    group: "read",
    input: FacilityTarget,
    output: v.object({ facility: Facility }),
  }),
  createFacility: action({
    group: "sensitive-write",
    extraLimit: "facilityCreateDaily",
    input: v.object({ categoryId: RequiredText, title: RequiredText, location: RequiredText, content: OptionalText }),
    output: v.object({ facility: Facility }),
  }),
  toggleFacilityAffected: action({
    group: "sensitive-write",
    extraLimit: "facilityAffectedToggleHourly",
    input: FacilityTarget,
    output: v.object({ affected: v.boolean(), affectedCount: Count }),
  }),
  updateFacilityStatus: action({
    group: "admin-write",
    extraLimit: "facilityStatusUpdateHourly",
    input: v.object({
      facilityId: Uuid,
      status: v.picklist(["processing", "completed", "unable-to-handle"], "invalid-status"),
      resultContent: v.optional(Text),
    }),
    output: v.object({ facility: Facility }),
  }),
  deleteFacility: action({
    group: "admin-write",
    extraLimit: "destructiveWriteHourly",
    input: FacilityTarget,
    output: Success,
  }),
};
