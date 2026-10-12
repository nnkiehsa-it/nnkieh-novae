import { API_ERRORS, isApiErrorCode } from "@/generated/api-errors";
import type { OperationsConsole, RetryKind } from "@/hooks/use-system-console";
import { formatDate } from "@/lib/format";
import type { Translate } from "../shared/translate";

const JOB_LABELS: Record<string, string> = {
  category_policy: "ui.operations.job.categoryPolicy",
  deletion: "ui.operations.job.deletion",
  notion_reconcile: "ui.operations.job.notionRebuild",
  retention_cleanup: "ui.operations.job.retentionCleanup",
};
const STATUS_LABELS: Record<string, string> = {
  completed: "ui.operations.status.completed",
  failed: "ui.operations.status.failed",
  pending: "ui.operations.status.pending",
  processing: "ui.operations.status.processing",
  superseded: "ui.operations.status.superseded",
};
const DESTINATION_LABELS: Record<string, string> = {
  in_app: "ui.operations.destination.inApp",
  notion: "ui.operations.destination.notion",
  push: "ui.operations.destination.push",
  realtime: "ui.operations.destination.realtime",
};

const labelled = (table: Record<string, string>, t: Translate, value: string) =>
  table[value] ? t(table[value]) : value;

export const jobLabel = (t: Translate, value: string) => labelled(JOB_LABELS, t, value);
export const statusLabel = (t: Translate, value: string) => labelled(STATUS_LABELS, t, value);
export const destinationLabel = (t: Translate, value: string) =>
  labelled(DESTINATION_LABELS, t, value);

/** What actually went wrong, out of what the failure recorded. */
export function errorMessage(detail: unknown): string {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && "message" in detail) {
    return String((detail as { message: unknown }).message ?? "");
  }
  return JSON.stringify(detail);
}

/** One field of a failure, as the record spells it. */
export interface FailureField {
  label: string;
  mono?: boolean;
  value: string;
}

/** A piece of stopped work: what it was, why it stopped, and how to resume it. */
export interface FailureItem {
  fields: FailureField[];
  id: string;
  kind: RetryKind;
  label: string;
  message: string;
  /** Absent for a recorded error, which is a count rather than stopped work. */
  retryable: boolean;
}

/** Failed jobs, failed deliveries and expired logs whose external deletion never landed, as one list. */
export function failureItems(
  snapshot: Partial<OperationsConsole>,
  t: Translate,
): FailureItem[] {
  const jobs = (snapshot.jobs ?? [])
    .filter((job) => job.status === "failed")
    .map((job) => ({
      fields: [
        { label: t("ui.operations.jobs"), value: jobLabel(t, job.jobType) },
        { label: t("admin.failureId"), mono: true, value: job.id },
        { label: t("ui.operations.attempts"), value: String(job.attemptCount) },
        { label: t("admin.failureTrace"), mono: true, value: job.lastAttemptId ?? "—" },
        { label: t("admin.failureAt"), value: formatDate(new Date(job.updatedAt)) },
      ],
      id: job.id,
      kind: "job" as const,
      label: jobLabel(t, job.jobType),
      message: errorMessage(job.errorDetail),
      retryable: true,
    }));

  const deliveries = (snapshot.failedDeliveries ?? []).map((entry) => ({
    fields: [
      { label: t("ui.operations.deliveries"), value: destinationLabel(t, entry.destination) },
      { label: t("admin.failureEvent"), value: entry.eventType },
      { label: t("admin.failureId"), mono: true, value: entry.id },
      { label: t("ui.operations.attempts"), value: String(entry.attemptCount) },
      { label: t("admin.failureOperation"), mono: true, value: entry.operationId },
      { label: t("admin.failureTrace"), mono: true, value: entry.lastAttemptId ?? "—" },
    ],
    id: entry.id,
    kind: "delivery" as const,
    label: destinationLabel(t, entry.destination),
    message: errorMessage(entry.errorDetail),
    retryable: true,
  }));

  const cleanup = (snapshot.cleanupBacklog ?? []).map((entry) => ({
    fields: [
      { label: t("admin.failureId"), mono: true, value: entry.jobId },
      { label: t("admin.failureAt"), value: formatDate(new Date(entry.createdAt)) },
      { label: t("admin.failureTarget"), mono: true, value: JSON.stringify(entry.payload) },
    ],
    id: entry.jobId,
    kind: "cleanup" as const,
    label: t("ui.operations.cleanupBacklog"),
    message: t("admin.cleanupBacklogMessage"),
    retryable: true,
  }));

  return [...jobs, ...deliveries, ...cleanup];
}

/** A refusal the platform already answered, counted rather than kept waiting. */
export function errorItems(
  snapshot: Partial<OperationsConsole>,
  t: Translate,
): FailureItem[] {
  return (snapshot.errors ?? []).map((entry) => ({
    fields: [
      { label: t("admin.failureAction"), value: entry.action },
      { label: t("admin.failureCode"), value: entry.code },
      { label: t("admin.failureStatus"), value: String(entry.status) },
      { label: t("admin.failureCount"), value: String(entry.count) },
      { label: t("admin.failureAt"), value: formatDate(new Date(entry.lastAt)) },
      { label: t("admin.failureOperation"), mono: true, value: entry.operationId ?? "—" },
      { label: t("admin.failureTrace"), mono: true, value: entry.failureId ?? "—" },
    ],
    id: `${entry.action}:${entry.code}:${entry.lastAt}`,
    kind: "job" as const,
    label: entry.action,
    message: isApiErrorCode(entry.code) ? t(API_ERRORS[entry.code].messageKey) : entry.code,
    retryable: false,
  }));
}
