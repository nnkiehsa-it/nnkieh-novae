"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import {
  CalendarClock,
  Hand,
  MessageCircle,
} from "lucide-react";
import type { IssueSummary, UserPublicProfile } from "@/types";
import { formatDateOnly, formatRelativeTime } from "@/lib/format";
import {
  getDerivedIssueStatus,
  getSupportProgressPercent,
} from "@/lib/issue-status";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { ContentAuthor } from "@/components/content-author";
import { FeedCard, FeedProgress } from "@/components/ui/feed-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";

export function IssueCard({
  filter,
  issue,
  onSupport,
  profile,
  reveal,
  burst,
  supporting,
}: {
  burst: number;
  filter: string;
  issue: IssueSummary;
  onSupport: () => void;
  profile?: UserPublicProfile;
  reveal: boolean;
  supporting: boolean;
}) {
  useLocaleSubscription();
  const goal = issue.support_goal;
  const progress = getSupportProgressPercent(issue.support_count, goal);
  return (
    <FeedCard
      href={`/issues/${encodeURIComponent(filter)}/${issue.id}`}
      label={issue.title}
      metadata={
        <>
              {issue.canViewAuthor && issue.author_uid ? (
                <ContentAuthor profile={profile} />
              ) : null}
              {issue.canViewAuthor && issue.author_uid ? (
                <span aria-hidden>·</span>
              ) : null}
              <SkeletonReveal enabled={reveal} skeleton={<Skeleton className="h-3 w-12" />}><span className="shrink-0">{formatRelativeTime(issue.created_at)}</span></SkeletonReveal>
        </>
      }
      title={<SkeletonReveal as="div" enabled={reveal} skeleton={<Skeleton className="h-7 w-3/5" />}><h2 className="truncate">{issue.title}</h2></SkeletonReveal>}
      footer={
        <>
          <StatusBadge domain="issue" revealLabel={reveal} status={getDerivedIssueStatus(issue)} />
          {issue.support_enabled ? (
            <LikeActionButton
              active={issue.currentUserSupported === true}
              burst={burst}
              busy={supporting}
              className="z-10 ml-auto"
              count={issue.support_count}
              disabled={
                issue.isOwnIssue ||
                !["pending", "processing"].includes(issue.status)
              }
              icon={Hand}
              inactiveVariant="ghost"
              label={
                issue.isOwnIssue
                  ? translate("ui.issue.ownSupport")
                  : issue.currentUserSupported
                    ? translate("ui.issue.cancelSupport")
                    : translate("ui.issue.support")
              }
              onClick={onSupport}
              size="sm"
            />
          ) : null}
          {issue.comments_enabled ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="size-3.5" />
            </span>
          ) : null}
        </>
      }
    >
      {issue.support_enabled && goal ? (
        <FeedProgress value={progress}>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            {issue.support_deadline_at ? (
              <span className="inline-flex min-w-0 items-center gap-1">
                <CalendarClock className="size-3.5 shrink-0" />
                <span className="truncate">{translate('ui.issue.supportEndsOn', { date: formatDateOnly(issue.support_deadline_at) })}</span>
              </span>
            ) : <span>{translate('ui.issue.supportProgress')}</span>}
            <SkeletonReveal className="min-w-14 text-right font-semibold text-tint-content" enabled={reveal} skeleton={<Skeleton className="h-4 w-14" />}>
              <span className="tabular-nums"><AnimatedNumber value={issue.support_count} /> / {goal}</span>
            </SkeletonReveal>
          </div>
        </FeedProgress>
      ) : null}
    </FeedCard>
  );
}
