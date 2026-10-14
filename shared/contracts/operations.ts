import * as v from "valibot";
import { OPERATION_POLICIES, type OperationPolicyKey } from "../operation-policies.ts";
import { action, Count, NoInput, Success, Timestamp, Uuid } from "../contract.ts";

function bounded(min: number, max: number) {
  return v.pipe(v.number(), v.integer(), v.minValue(min), v.maxValue(max));
}

/** Every runtime policy, each a whole number within the bounds an administrator may set. */
export const OperationPolicies = v.strictObject(
  Object.fromEntries(Object.entries(OPERATION_POLICIES).map(([key, spec]) => [key, bounded(spec.min, spec.max)])) as
    Record<OperationPolicyKey, ReturnType<typeof bounded>>,
  "validation-invalid",
);

const PolicyRevision = v.pipe(v.number(), v.integer(), v.minValue(0));

/** The policies in force and the revision they were saved under. */
export const PolicySnapshot = v.object({ revision: PolicyRevision, values: OperationPolicies });
export type PolicySnapshot = v.InferOutput<typeof PolicySnapshot>;

export const JobStatus = v.picklist(["pending", "processing", "completed", "failed", "superseded"]);

/** Background work, as the queue shows its progress. */
export const OperationJob = v.object({
  id: Uuid,
  jobType: v.string(),
  status: JobStatus,
  attemptCount: Count,
  estimatedRows: Count,
  processedRows: Count,
  affectedRows: Count,
  lastAttemptId: v.nullable(Uuid),
  errorDetail: v.unknown(),
  updatedAt: Timestamp,
});
export type OperationJob = v.InferOutput<typeof OperationJob>;

/** What the queue holds: work still running or stopped, and refusals already counted. */
const OperationsQueue = v.object({
  jobs: v.array(OperationJob),
  deliveries: v.array(v.object({ destination: v.string(), status: JobStatus, count: Count, oldestAt: Timestamp })),
  failedDeliveries: v.array(v.object({
    id: Uuid,
    destination: v.string(),
    eventType: v.string(),
    operationId: v.nullable(Uuid),
    attemptCount: Count,
    lastAttemptId: v.nullable(Uuid),
    errorDetail: v.unknown(),
  })),
  cleanupBacklog: v.array(v.object({ jobId: Uuid, createdAt: Timestamp, payload: v.unknown() })),
  errors: v.array(v.object({
    action: v.string(),
    code: v.string(),
    status: Count,
    count: Count,
    lastAt: Timestamp,
    operationId: v.nullable(Uuid),
    failureId: v.nullable(Uuid),
  })),
  hasMore: v.boolean(),
  sampledAt: Timestamp,
});
export type OperationsQueue = v.InferOutput<typeof OperationsQueue>;

/** The queue and what the database is taking up. */
const OperationsConsole = v.object({
  ...OperationsQueue.entries,
  capacity: v.array(v.object({ name: v.string(), rows: Count, deadRows: Count, totalBytes: Count })),
  metrics: v.array(v.object({ bucket: v.string(), databaseBytes: Count })),
  databaseBytes: Count,
});
export type OperationsConsole = v.InferOutput<typeof OperationsConsole>;

/** A saved change to the policies. Entries older than a policy do not mention it. */
export const PolicyChange = v.object({
  id: Count,
  actorUid: v.string(),
  revision: PolicyRevision,
  reason: v.string(),
  beforeValue: v.record(v.string(), v.number()),
  afterValue: v.record(v.string(), v.number()),
  createdAt: Timestamp,
});
export type PolicyChange = v.InferOutput<typeof PolicyChange>;

const Page = v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(1_000_000)), 0);

const ProviderDiagnostic = v.variant("status", [
  v.object({
    provider: v.string(),
    status: v.literal("available"),
    checkedAt: Timestamp,
    data: v.unknown(),
    nextCursor: v.optional(v.nullable(v.string())),
    until: v.optional(v.number()),
  }),
  v.object({ provider: v.string(), status: v.literal("not-configured"), checkedAt: Timestamp }),
  v.object({ provider: v.string(), status: v.literal("unavailable"), checkedAt: Timestamp, error: v.string() }),
]);
export type ProviderDiagnostic = v.InferOutput<typeof ProviderDiagnostic>;

/** Whether the platform is keeping up, as the overview reads it. */
export const PlatformDashboard = v.object({
  status: v.picklist(["healthy", "attention", "critical"]),
  issuesByCategory: v.record(v.string(), Count),
  pendingNotionSync: Count,
  failedDeliveries: Count,
  failedPushDeliveries: Count,
  cleanupBacklog: Count,
  stuckUploads: Count,
  recentFailures: v.array(v.object({
    id: v.string(),
    source: v.string(),
    status: v.string(),
    failureId: v.nullable(v.string()),
    updatedAt: Timestamp,
  })),
});
export type PlatformDashboard = v.InferOutput<typeof PlatformDashboard>;

const Cleared = { ...Success.entries, cleared: Count };

export const OPERATION_ACTIONS = {
  getRuntimePolicies: action({ group: "read", input: NoInput, output: PolicySnapshot }),
  getOperationsConsole: action({ group: "read", input: v.object({ page: Page }), output: OperationsConsole }),
  getOperationsQueue: action({ group: "read", input: v.object({ page: Page }), output: OperationsQueue }),
  getOperationPolicies: action({
    group: "read",
    input: NoInput,
    output: v.object({ settings: PolicySnapshot, history: v.array(PolicyChange) }),
  }),
  saveOperationPolicies: action({
    group: "admin-write",
    extraLimit: "roleWriteHourly",
    input: v.object({
      revision: PolicyRevision,
      values: OperationPolicies,
      reason: v.pipe(v.string(), v.trim(), v.minLength(1, "validation-invalid"), v.maxLength(500, "validation-invalid")),
    }),
    output: PolicySnapshot,
  }),
  getProviderDiagnostics: action({
    group: "read",
    input: v.object({
      provider: v.picklist(["cloudinary", "cloudflare", "logs"]),
      cursor: v.optional(v.pipe(v.string(), v.maxLength(300))),
      query: v.optional(v.pipe(v.string(), v.maxLength(200))),
      until: v.optional(v.pipe(v.number(), v.safeInteger(), v.minValue(86_400_000), v.check((until) => until <= Date.now() + 60_000))),
    }),
    output: ProviderDiagnostic,
  }),
  rebuildNotionArchive: action({
    group: "admin-write",
    extraLimit: "destructiveWriteHourly",
    input: NoInput,
    output: v.object({
      ...Success.entries,
      jobId: Uuid,
      cleared: v.object({ cleanup: Count, deliveries: Count, jobs: Count, mappings: Count }),
    }),
  }),
  clearOperationalErrors: action({
    group: "admin-write",
    extraLimit: "destructiveWriteHourly",
    input: NoInput,
    output: v.object(Cleared),
  }),
  clearScheduledWork: action({
    group: "admin-write",
    extraLimit: "destructiveWriteHourly",
    input: NoInput,
    output: v.object({ ...Cleared, cleanup: Count, jobs: Count }),
  }),
  retryOperationalWork: action({
    group: "admin-write",
    extraLimit: "destructiveWriteHourly",
    input: v.variant("kind", [
      v.object({ kind: v.literal("all") }),
      v.object({ kind: v.picklist(["job", "delivery", "cleanup"]), id: Uuid }),
    ]),
    output: v.object({ ...Success.entries, retried: Count }),
  }),
  getPlatformDashboard: action({ group: "read", input: NoInput, output: PlatformDashboard }),
};
