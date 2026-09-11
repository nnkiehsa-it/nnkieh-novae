"use client";
import { t as translate, useI18n as useLocaleSubscription } from "@/i18n";

import type { IssueRecord, UserPublicProfile } from "@/types";
import { getIssueCategoryLabel } from "@/constants/categories";
import { ISSUE_STATUS_LABELS } from "@/constants/statuses";
import { formatDate } from "@/lib/format";
import { getIssueNotice } from "@/lib/issue-notice";
import { ContentRenderer } from "@/components/content-renderer";
import { ContentAuthor } from "@/components/content-author";
import { ContentResolutionNotice } from "@/components/content-resolution-notice";
import { DetailBadge, DetailCardHeader, DetailCardBody } from "@/components/ui/detail-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SkeletonReveal } from "@/components/ui/skeleton-reveal";

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
    <>
      <DetailCardHeader
        badges={<>
          <DetailBadge reveal={reveal}>
            {getIssueCategoryLabel(issue.category)}
          </DetailBadge>
          <StatusBadge domain="issue" revealLabel={reveal} status={status} />
        </>}
        title={<SkeletonReveal as="div" enabled={reveal} skeleton={<Skeleton className="h-9 w-3/5" />}>
          <h1 className="text-balance">
            {issue.title}
          </h1>
        </SkeletonReveal>}
        metadata={<>
          <SkeletonReveal enabled={reveal} skeleton={<Skeleton className="h-4 w-32" />}><span>{formatDate(issue.created_at)}</span></SkeletonReveal>
          {issue.canViewAuthor && showAuthor ? (
            <ContentAuthor profile={profile ?? undefined} />
          ) : null}
        </>}
      />
      {hasContent ? (
        <DetailCardBody>
          <ContentRenderer
            content={issue.content}
            fallbackAlt={issue.title}
            revealText={reveal}
          />
        </DetailCardBody>
      ) : null}
      {notice ? (
        <ContentResolutionNotice
          content={notice.content}
          fallbackAlt={translate("ui.issue.resultAlt", { title: issue.title })}
          reveal={reveal}
          title={translate(notice.title)}
          tone={notice.tone}
        />
      ) : null}
    </>
  );
}
