"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import type { IssueRecord, UserPublicProfile } from "@/types";
import { getIssueCategoryLabel } from "@/constants/categories";
import { ISSUE_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/format";
import { getIssueNotice } from "@/lib/issue-notice";
import { cn } from "@/lib/utils";
import { ContentRenderer } from "@/components/content-renderer";
import { ContentAuthor } from "@/components/content-author";
import { ContentResolutionNotice } from "@/components/content-resolution-notice";
import { ContentMorph } from "@/components/motion/content-morph";
import { CardContent } from "@/components/ui/card";
import { ResizableCard } from "@/components/ui/resizable-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  SkeletonBadgeLabel,
  SkeletonReveal,
} from "@/components/ui/skeleton-reveal";

export function IssueDetailContent({
  issue,
  profile,
  reveal,
  showAuthor,
  status,
}: {
  issue: IssueRecord;
  profile: UserPublicProfile | null;
  reveal: boolean;
  showAuthor: boolean;
  status: IssueRecord["status"];
}) {
  useLocaleSubscription();
  const hasContent = Boolean(issue.content?.trim());
  const notice = getIssueNotice(
    issue,
    translate(ISSUE_STATUS_LABELS[issue.status]),
  );
  return (
    <ContentMorph id={issue.id} kind="issue">
    <ResizableCard className="gap-0 overflow-hidden py-0">
      <div
        className={cn(
          "px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6",
          (hasContent || notice) && "border-b",
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-grid place-items-center rounded-full bg-card px-2.5 py-1 text-center text-xs font-medium text-muted-foreground shadow-[var(--shadow-control)]">
            <SkeletonBadgeLabel
              className="min-w-16"
              enabled={reveal}
              skeleton={<Skeleton className="h-3 w-16" />}
            >
              {getIssueCategoryLabel(issue.category)}
            </SkeletonBadgeLabel>
          </span>
          <StatusBadge domain="issue" revealLabel={reveal} status={status} />
        </div>
        <SkeletonReveal as="div" className="mt-3" enabled={reveal} skeleton={<Skeleton className="h-8 w-3/5" />}>
          <h1 className="text-balance text-2xl font-semibold leading-8 sm:text-[1.75rem] sm:leading-9">
            {issue.title}
          </h1>
        </SkeletonReveal>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-muted-foreground">
          <SkeletonReveal enabled={reveal} skeleton={<Skeleton className="h-4 w-32" />}><span>{formatDate(issue.created_at)}</span></SkeletonReveal>
          {issue.canViewAuthor && showAuthor ? (
            <ContentAuthor profile={profile ?? undefined} />
          ) : null}
        </div>
      </div>
      {hasContent ? (
        <CardContent className="py-5 sm:px-7 sm:py-6">
          <ContentRenderer
            content={issue.content}
            fallbackAlt={issue.title}
            revealText={reveal}
          />
        </CardContent>
      ) : null}
      {notice ? (
        <ContentResolutionNotice
          content={notice.content}
          fallbackAlt={translate("ui.issue.resultAlt", { title: issue.title })}
          reveal={reveal}
          separated={hasContent}
          title={translate(notice.title)}
          tone={notice.tone}
        />
      ) : null}
    </ResizableCard>
    </ContentMorph>
  );
}
