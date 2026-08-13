"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Hand,
  MessageCircle,
} from "lucide-react";
import type { IssueRecord, UserPublicProfile } from "@/types";
import { formatDateOnly, formatRelativeTime, stripMarkdownImages } from "@/lib/format";
import {
  getDerivedIssueStatus,
  getSupportProgressPercent,
} from "@/lib/issue-status";
import { AnimatedNumber } from "@/components/motion/animated-number";
import { LikeActionButton } from "@/components/motion/like-action-button";
import { ContentAuthor } from "@/components/content-author";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export function IssueCard({
  filter,
  issue,
  onSupport,
  profile,
  burst,
  supporting,
}: {
  burst: number;
  filter: string;
  issue: IssueRecord;
  onSupport: () => void;
  profile?: UserPublicProfile;
  supporting: boolean;
}) {
  useLocaleSubscription();
  const goal = issue.support_goal;
  const progress = getSupportProgressPercent(issue.support_count, goal);
  return (
    <Card className="t-card group relative h-full gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-muted-foreground">
              {issue.canViewAuthor && issue.author_uid ? (
                <ContentAuthor profile={profile} />
              ) : null}
              {issue.canViewAuthor && issue.author_uid ? (
                <span aria-hidden>·</span>
              ) : null}
              <span className="shrink-0">{formatRelativeTime(issue.created_at)}</span>
            </div>
            <h2 className="mt-1.5 text-balance font-semibold leading-6 tracking-[-0.015em]">
              <Link className="outline-none after:absolute after:inset-0 focus-visible:underline" href={`/issues/${encodeURIComponent(filter)}/${issue.id}`}>
                {issue.title}
              </Link>
            </h2>
          </div>
          <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-250 ease-[var(--ease-smooth-out)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        {issue.content ? (
          <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
            {stripMarkdownImages(issue.content)}
          </p>
        ) : null}
        {issue.support_enabled && goal ? (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{translate('ui.issue.supportProgress')}</span>
              <span className="tabular-nums">
                <AnimatedNumber value={issue.support_count} /> / {goal}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full origin-left rounded-full bg-foreground transition-transform duration-500 ease-[var(--ease-smooth-out)]"
                style={{ transform: `scaleX(${progress / 100})` }}
              />
            </div>
            {issue.support_deadline_at ? (
              <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground/80">
                <CalendarClock className="size-3.5" />
                {translate('ui.issue.supportEndsOn', {
                  date: formatDateOnly(issue.support_deadline_at),
                })}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t pt-3">
          <StatusBadge domain="issue" status={getDerivedIssueStatus(issue)} />
          {issue.support_enabled ? (
            <LikeActionButton
              active={issue.currentUserSupported === true}
              burst={burst}
              busy={supporting}
              className="z-10 ml-auto"
              count={issue.support_count}
              disabled={!["pending", "processing"].includes(issue.status)}
              icon={Hand}
              label={issue.currentUserSupported ? translate('ui.issue.cancelSupport') : translate('ui.issue.support')}
              onClick={onSupport}
              size="sm"
              variant="ghost"
            />
          ) : null}
          {issue.comments_enabled ? (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="size-3.5" />
            </span>
          ) : null}
        </div>
    </Card>
  );
}
