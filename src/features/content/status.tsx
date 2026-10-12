import { useI18n } from "@/i18n";
import { FACILITY_STATUS_LABELS, ISSUE_STATUS_LABELS } from "@/constants/statuses";
import type { FacilityStatus, IssueStatus } from "@/types";
import { Chip } from "@/ui/chip";

export type ContentStatus = IssueStatus | FacilityStatus;
export type StatusTone = "neutral" | "info" | "caution" | "positive" | "danger";

// A case being looked at reads as caution, one being worked on as info, a
// finished one as positive, and every way of closing it unfinished as danger.
const STATUS_TONE: Record<ContentStatus, StatusTone> = {
  "under-review": "caution",
  pending: "neutral",
  processing: "info",
  completed: "positive",
  "auto-rejected": "danger",
  "review-rejected": "danger",
  infeasible: "danger",
  "unable-to-handle": "danger",
};

const TONE_COLOR: Record<StatusTone, string> = {
  neutral: "var(--ink-muted)",
  info: "var(--info)",
  caution: "var(--caution)",
  positive: "var(--positive)",
  danger: "var(--danger)",
};

export function statusTone(status: ContentStatus) {
  return STATUS_TONE[status];
}

/** The status colour as a CSS value, for charts and progress marks. */
export function statusColor(status: ContentStatus) {
  return TONE_COLOR[STATUS_TONE[status]];
}

export function statusLabelKey(domain: "facility" | "issue", status: ContentStatus) {
  return domain === "facility" ? FACILITY_STATUS_LABELS[status as FacilityStatus] : ISSUE_STATUS_LABELS[status as IssueStatus];
}

export function StatusChip({ className, domain, status }: { className?: string; domain: "facility" | "issue"; status: ContentStatus }) {
  const { t } = useI18n();
  return <Chip className={className} tone={STATUS_TONE[status]}>{t(statusLabelKey(domain, status))}</Chip>;
}
