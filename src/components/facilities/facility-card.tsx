"use client";

import { Hand, MapPin } from "lucide-react";
import { t as translate } from "@/i18n";
import type { FacilitySummary, UserPublicProfile } from "@/types";
import { formatRelativeTime } from "@/lib/format";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { ContentAuthor } from "@/components/content-author";
import { FeedCard } from "@/components/ui/feed-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";

export function FacilityCard({
  affecting,
  burst,
  facility,
  onToggleAffected,
  profile,
  reveal,
}: {
  affecting: boolean;
  burst: number;
  facility: FacilitySummary;
  onToggleAffected: () => void;
  profile?: UserPublicProfile;
  reveal: boolean;
}) {
  return (
    <FeedCard
      href={`/facilities/${facility.id}?category=${encodeURIComponent(facility.category_id)}`}
      label={facility.title}
      metadata={
        <>
              <ContentAuthor profile={profile} />
              <span aria-hidden>·</span>
              <SkeletonReveal enabled={reveal} skeleton={<Skeleton className="h-3 w-12" />}><span className="shrink-0">{formatRelativeTime(facility.created_at)}</span></SkeletonReveal>
        </>
      }
      title={<SkeletonReveal as="div" enabled={reveal} skeleton={<Skeleton className="h-7 w-3/5" />}><h2 className="truncate">{facility.title}</h2></SkeletonReveal>}
      footer={
        <>
          <StatusBadge domain="facility" revealLabel={reveal} status={facility.status} />
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" />
            <SkeletonReveal className="min-w-24" enabled={reveal} skeleton={<Skeleton className="h-4 w-24" />}>
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
            inactiveVariant="ghost"
            label={facility.currentUserAffected ? translate('ui.facility.cancelAffected') : translate('ui.facility.markAffected')}
            onClick={onToggleAffected}
            size="sm"
          />
        </>
      }
    />
  );
}
