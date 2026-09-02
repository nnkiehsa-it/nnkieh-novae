"use client";

import Link from "next/link";
import { ArrowUpRight, Heart, MessageCircle } from "lucide-react";
import { t as translate } from "@/i18n";
import type { AnnouncementSummary, UserPublicProfile } from "@/types";
import { formatRelativeTime } from "@/lib/format";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { ContentMorph } from "@/components/motion/content-morph";
import { ContentAuthor } from "@/components/content-author";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
    <ContentMorph id={announcement.id} kind="announcement">
      <Card className="t-card group relative h-full gap-4 p-5 sm:p-6">
        <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
              <ContentAuthor profile={profile} />
              <span aria-hidden>·</span>
              <SkeletonReveal enabled={reveal} skeleton={<Skeleton className="h-3 w-12" />}><span className="shrink-0">{formatRelativeTime(announcement.published_at)}</span></SkeletonReveal>
            </div>
            <SkeletonReveal as="div" className="mt-1.5" enabled={reveal} skeleton={<Skeleton className="h-5 w-3/5" />}><h2 className="line-clamp-1 truncate font-semibold leading-6 tracking-[-0.015em]">
              {announcement.title}
            </h2></SkeletonReveal>
          </div>
          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-250 ease-[var(--ease-smooth-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <div className="mt-auto flex items-center gap-2 border-t pt-3">
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
        </div>
        </div>
        <Link
          aria-label={announcement.title}
          className="absolute inset-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          href={`/announcements/${announcement.id}`}
        />
      </Card>
    </ContentMorph>
  );
}
