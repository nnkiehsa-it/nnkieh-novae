import type { ReactNode } from "react";
import { CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "./badge";
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
    <Badge color="gray">
      <SkeletonBadgeLabel
        className="min-w-16"
        enabled={reveal}
        skeleton={<Skeleton className="h-3 w-16" />}
      >
        {children}
      </SkeletonBadgeLabel>
    </Badge>
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
    <CardHeader className="display-block">
      <div className="flex min-h-6 flex-wrap items-center gap-2">{badges}</div>
      <div className="mt-3 min-h-9 text-2xl font-semibold leading-9 tracking-[-0.035em] sm:text-[1.625rem]">{title}</div>
      <div className="mt-3 flex min-h-6 flex-wrap items-center gap-x-3 gap-y-2 text-[0.8125rem] text-muted-foreground">{metadata}</div>
    </CardHeader>
  );
}

export function DetailCardBody({ children }: { children: ReactNode }) {
  return <CardContent>{children}</CardContent>;
}
