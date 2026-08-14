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

export function StatusBadge({
  className,
  domain,
  revealLabel = false,
  status,
}: {
  className?: string;
  domain: "facility" | "issue";
  revealLabel?: boolean;
  status: IssueStatus | FacilityStatus;
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
        status === "under-review" &&
          "bg-[var(--status-review-bg)] text-[var(--status-review-fg)]",
        status === "pending" &&
          "bg-[var(--status-pending-bg)] text-[var(--status-pending-fg)]",
        status === "processing" &&
          "bg-[var(--status-processing-bg)] text-[var(--status-processing-fg)]",
        status === "completed" &&
          "bg-[var(--status-completed-bg)] text-[var(--status-completed-fg)]",
        status === "auto-rejected" &&
          "bg-[var(--status-auto-rejected-bg)] text-[var(--status-auto-rejected-fg)]",
        status === "review-rejected" &&
          "bg-[var(--status-rejected-bg)] text-[var(--status-rejected-fg)]",
        (status === "infeasible" || status === "unable-to-handle") &&
          "bg-[var(--status-infeasible-bg)] text-[var(--status-infeasible-fg)]",
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
