import * as v from "valibot";

export const ISSUE_STATUSES = [
  "under-review",
  "pending",
  "processing",
  "auto-rejected",
  "review-rejected",
  "infeasible",
  "completed",
] as const;
export const IssueStatus = v.picklist(ISSUE_STATUSES);
export type IssueStatus = v.InferOutput<typeof IssueStatus>;

export const FACILITY_STATUSES = ["pending", "processing", "completed", "unable-to-handle"] as const;
export const FacilityStatus = v.picklist(FACILITY_STATUSES);
export type FacilityStatus = v.InferOutput<typeof FacilityStatus>;
