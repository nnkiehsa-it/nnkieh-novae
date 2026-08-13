"use client";

import Link from "next/link";
import { ArrowUpRight, Hand, MapPin } from "lucide-react";
import { t as translate } from "@/i18n";
import type { FacilitySummary, UserPublicProfile } from "@/types";
import { formatRelativeTime } from "@/lib/format";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { ContentAuthor } from "@/components/content-author";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";

export function FacilityCard({
  affecting,
  burst,
  facility,
  onToggleAffected,
  profile,
}: {
  affecting: boolean;
  burst: number;
  facility: FacilitySummary;
  onToggleAffected: () => void;
  profile?: UserPublicProfile;
}) {
  return (
      <Card className="t-card group relative h-full gap-4 p-5 sm:p-6">
        <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
              <ContentAuthor profile={profile} revealName />
              <span aria-hidden>·</span>
              <SkeletonReveal skeleton={<Skeleton className="h-3 w-12" />}><span className="shrink-0">{formatRelativeTime(facility.created_at)}</span></SkeletonReveal>
            </div>
            <SkeletonReveal as="div" className="mt-1.5" skeleton={<Skeleton className="h-5 w-4/5" />}><h2 className="text-balance font-semibold leading-6 tracking-[-0.015em]">
              {facility.title}
            </h2></SkeletonReveal>
          </div>
          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-250 ease-[var(--ease-smooth-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
          <StatusBadge domain="facility" revealLabel status={facility.status} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            <SkeletonReveal className="min-w-24" skeleton={<Skeleton className="h-4 w-24" />}>
              <span>{facility.location}</span>
            </SkeletonReveal>
          </span>
          <LikeActionButton
            active={facility.currentUserAffected === true}
            burst={burst}
            busy={affecting}
            className="z-10 ml-auto"
            count={facility.affected_count}
            disabled={["completed", "unable-to-handle"].includes(facility.status)}
            icon={Hand}
            label={facility.currentUserAffected ? translate('ui.facility.cancelAffected') : translate('ui.facility.markAffected')}
            onClick={onToggleAffected}
            size="sm"
            variant="ghost"
          />
        </div>
        </div>
        <Link
          aria-label={facility.title}
          className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          href={`/facilities/${facility.id}?category=${encodeURIComponent(facility.category_id)}`}
        />
      </Card>
  );
}
