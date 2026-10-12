import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";
import type { FacilityStatus, IssueStatus } from "@/types";
import {
  FACILITY_STATUS_LABELS,
  ISSUE_STATUS_LABELS,
} from "@/constants/statuses";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonBadgeLabel } from "@/components/ui/skeleton-reveal";

export type ContentStatus = IssueStatus | FacilityStatus;

// One colour per state, written out rather than composed, because Tailwind only
// emits the classes it can read literally. A facility that cannot be resolved
// carries the same tone as an infeasible proposal: the case is closed unfinished.
export const STATUS_SURFACE_CLASS: Record<ContentStatus, string> = {
  "under-review": "bg-[var(--status-review-bg)] text-[var(--status-review-fg)]",
  pending: "bg-[var(--status-pending-bg)] text-[var(--status-pending-fg)]",
  processing: "bg-[var(--status-processing-bg)] text-[var(--status-processing-fg)]",
  completed: "bg-[var(--status-completed-bg)] text-[var(--status-completed-fg)]",
  "auto-rejected": "bg-[var(--status-auto-rejected-bg)] text-[var(--status-auto-rejected-fg)]",
  "review-rejected": "bg-[var(--status-rejected-bg)] text-[var(--status-rejected-fg)]",
  infeasible: "bg-[var(--status-infeasible-bg)] text-[var(--status-infeasible-fg)]",
  "unable-to-handle": "bg-[var(--status-infeasible-bg)] text-[var(--status-infeasible-fg)]",
};

const STATUS_TOKEN: Record<ContentStatus, string> = {
  "under-review": "review",
  pending: "pending",
  processing: "processing",
  completed: "completed",
  "auto-rejected": "auto-rejected",
  "review-rejected": "rejected",
  infeasible: "infeasible",
  "unable-to-handle": "infeasible",
};

/** The state's colour as text: the readable half of its pair in either theme. */
export function statusTextColor(status: ContentStatus) {
  return `var(--status-${STATUS_TOKEN[status]}-fg)`;
}

/**
 * The state's colour as a filled shape. Neither half of the pair works alone —
 * the text colour is a heavy slab in daylight and the surface colour disappears at
 * night — so a fill sits between them and lands mid-tone whichever way the theme runs.
 */
export function statusFillColor(status: ContentStatus) {
  const token = STATUS_TOKEN[status];
  return `color-mix(in srgb, var(--status-${token}-fg) 55%, var(--status-${token}-bg))`;
}

export function StatusBadge({
  className,
  domain,
  revealLabel = false,
  status,
}: {
  className?: string;
  domain: "facility" | "issue";
  revealLabel?: boolean;
  status: ContentStatus;
}) {
  useLocaleSubscription();
  const labelKey =
    domain === "facility"
      ? FACILITY_STATUS_LABELS[status as FacilityStatus]
      : ISSUE_STATUS_LABELS[status as IssueStatus];
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border-current/10 px-2.5 py-1 font-semibold",
        STATUS_SURFACE_CLASS[status],
        className,
      )}
    >
      <SkeletonBadgeLabel
        className="min-w-12"
        enabled={revealLabel}
        skeleton={<Skeleton className="h-3 w-12" />}
      >
        {translate(labelKey)}
      </SkeletonBadgeLabel>
    </Badge>
  );
}
