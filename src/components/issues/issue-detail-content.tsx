"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import { Check } from "lucide-react";
import type { IssueRecord, UserPublicProfile } from "@/types";
import { getIssueCategoryLabel } from "@/constants/categories";
import { formatDate } from "@/lib/format";
import { ContentRenderer } from "@/components/content-renderer";
import { ContentAuthor } from "@/components/content-author";
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
  status,
}: {
  issue: IssueRecord;
  profile: UserPublicProfile | null;
  reveal: boolean;
  status: IssueRecord["status"];
}) {
  useLocaleSubscription();
  return (
    <ResizableCard className="gap-0 overflow-hidden py-0">
      <div className="border-b px-5 pb-5 pt-5 sm:px-7 sm:pb-6 sm:pt-6">
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
          {issue.canViewAuthor ? (
            <ContentAuthor profile={profile ?? undefined} />
          ) : null}
        </div>
      </div>
      <CardContent className="py-5 sm:px-7 sm:py-6">
        <ContentRenderer
          content={issue.content}
          fallbackAlt={issue.title}
          revealText={reveal}
        />
      </CardContent>
      {issue.result_content ? (
        <div className="border-t bg-emerald-500/[0.045] px-5 py-5 sm:px-7">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-success">
            <span
              className="t-success-check grid size-6 place-items-center rounded-full bg-success/12"
              data-state="in"
            >
              <Check className="size-3.5" />
            </span>{translate('ui.common.result')}</div>
          <ContentRenderer
            content={issue.result_content}
            fallbackAlt={translate('ui.issue.resultAlt', { title: issue.title })}
            revealText={reveal}
          />
        </div>
      ) : null}
    </ResizableCard>
  );
}
