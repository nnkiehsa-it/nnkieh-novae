"use client";

import Link from "next/link";
import { ArrowUpRight, Heart, MessageCircle } from "lucide-react";
import { t as translate } from "@/i18n";
import type { AnnouncementRecord, UserPublicProfile } from "@/types";
import { formatRelativeTime, stripMarkdownImages } from "@/lib/format";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { ContentAuthor } from "@/components/content-author";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function AnnouncementCard({
  announcement,
  burst,
  liking,
  onLike,
  profile,
}: {
  announcement: AnnouncementRecord;
  burst: number;
  liking: boolean;
  onLike: () => void;
  profile?: UserPublicProfile;
}) {
  return (
      <Card className="t-card group relative h-full gap-4 p-5 sm:p-6">
        <div className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="t-data-content-enter t-stagger-copy min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
              <ContentAuthor profile={profile} />
              <span aria-hidden>·</span>
              <span className="shrink-0">{formatRelativeTime(announcement.published_at)}</span>
            </div>
            <h2 className="mt-1.5 text-balance font-semibold leading-6 tracking-[-0.015em]">
              {announcement.title}
            </h2>
          </div>
          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-250 ease-[var(--ease-smooth-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <p className="t-data-content-enter t-stagger-copy line-clamp-2 text-sm leading-6 text-muted-foreground">
          {stripMarkdownImages(announcement.content)}
        </p>
        <div className="mt-auto flex items-center gap-2 border-t pt-3">
          <LikeActionButton
            active={announcement.currentUserLiked === true}
            burst={burst}
            busy={liking}
            className="z-10 ml-auto"
            count={announcement.like_count}
            icon={Heart}
            label={announcement.currentUserLiked ? translate('ui.announcement.liked') : translate('ui.announcement.like')}
            onClick={onLike}
            reaction="heart"
            size="sm"
            variant="ghost"
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
  );
}
