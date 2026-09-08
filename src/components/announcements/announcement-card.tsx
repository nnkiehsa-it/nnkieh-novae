"use client";

import Link from "next/link";
import { Heart, MessageCircle } from "lucide-react";
import { t as translate } from "@/i18n";
import type { AnnouncementSummary, UserPublicProfile } from "@/types";
import { formatRelativeTime } from "@/lib/format";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { ContentAuthor } from "@/components/content-author";
import { Button } from "@/components/ui/button";
import { FeedCard } from "@/components/ui/feed-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";

export function AnnouncementCard({
  announcement,
  burst,
  liking,
  onLike,
  profile,
  reveal,
}: {
  announcement: AnnouncementSummary;
  burst: number;
  liking: boolean;
  onLike: () => void;
  profile?: UserPublicProfile;
  reveal: boolean;
}) {
  return (
    <FeedCard
      href={`/announcements/${announcement.id}`}
      label={announcement.title}
      metadata={
        <>
              <ContentAuthor profile={profile} />
              <span aria-hidden>·</span>
              <SkeletonReveal enabled={reveal} skeleton={<Skeleton className="h-3 w-12" />}><span className="shrink-0">{formatRelativeTime(announcement.published_at)}</span></SkeletonReveal>
        </>
      }
      title={<SkeletonReveal as="div" enabled={reveal} skeleton={<Skeleton className="h-7 w-3/5" />}><h2 className="truncate">{announcement.title}</h2></SkeletonReveal>}
      footer={
        <>
          <LikeActionButton
            active={announcement.currentUserLiked === true}
            burst={burst}
            busy={liking}
            className="z-10 ml-auto"
            count={announcement.like_count}
            icon={Heart}
            inactiveVariant="ghost"
            label={announcement.currentUserLiked ? translate('ui.announcement.liked') : translate('ui.announcement.like')}
            onClick={onLike}
            reaction="heart"
            size="sm"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild className="relative z-10" size="sm" variant="ghost">
                <Link
                  aria-label={translate('comments.viewComments')}
                  href={`/announcements/${announcement.id}#discussion-title`}
                >
                  <MessageCircle />
                  <AnimatedNumber value={announcement.comment_count} />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{translate('comments.viewComments')}</TooltipContent>
          </Tooltip>
        </>
      }
    />
  );
}
