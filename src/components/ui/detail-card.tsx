import type { ReactNode } from "react";
import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonBadgeLabel } from "@/components/ui/skeleton-reveal";

/**
 * The neutral pill a detail header opens with: the kind of thing being read,
 * before any status colour. A proposal and a facility report name their
 * category here and an announcement names itself, so all three read as one row.
 */
export function DetailBadge({
  children,
  reveal = false,
}: {
  children: ReactNode;
  reveal?: boolean;
}) {
  return (
    <span className="inline-grid place-items-center rounded-full bg-card px-2.5 py-1 text-center text-xs font-medium text-muted-foreground shadow-[var(--shadow-control)]">
      <SkeletonBadgeLabel
        className="min-w-16"
        enabled={reveal}
        skeleton={<Skeleton className="h-3 w-16" />}
      >
        {children}
      </SkeletonBadgeLabel>
    </span>
  );
}

export function DetailCardHeader({
  badges,
  metadata,
  title,
}: {
  badges: ReactNode;
  metadata: ReactNode;
  title: ReactNode;
}) {
  return (
    <div className="bg-background/60 px-5 py-5 sm:px-6">
      <div className="flex min-h-6 flex-wrap items-center gap-2">{badges}</div>
      <div className="mt-3 min-h-9 text-2xl font-semibold leading-9 tracking-[-0.035em] sm:text-[1.625rem]">{title}</div>
      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-2 text-[0.8125rem] text-muted-foreground">{metadata}</div>
    </div>
  );
}

export function DetailCardBody({ children }: { children: ReactNode }) {
  return <CardContent className="py-5 sm:px-6">{children}</CardContent>;
}
