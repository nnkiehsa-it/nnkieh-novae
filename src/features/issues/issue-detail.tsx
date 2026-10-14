"use client";

import * as React from "react";
import { ShieldCheck } from "@phosphor-icons/react/ssr";
import { useI18n } from "@/i18n";
import { getIssueCategoryLabel } from "@/constants/categories";
import { formatDate } from "@/lib/format";
import { getIssueNotice } from "@/lib/issue-notice";
import { useIssueDetail } from "@/hooks/use-issue-detail";
import { Discussion } from "@/features/content/discussion";
import { Markdown } from "@/features/content/markdown";
import { Author } from "@/features/content/person";
import { RecordActions, RecordError, RecordHeader, RecordSkeleton, type RecordAction } from "@/features/content/record-view";
import { ResolutionNotice } from "@/features/content/resolution-notice";
import { StatusChip, statusLabelKey } from "@/features/content/status";
import { Chip } from "@/ui/chip";
import { Switch } from "@/ui/switch";
import { SupportPanel, Timeline } from "./issue-panels";
import { ModerationSheet } from "./moderation-sheet";

export function IssueDetail() {
  const { t } = useI18n();
  const detail = useIssueDetail();
  const issue = detail.issue;
  // Managers can hide the author while presenting a proposal on a shared screen.
  const [authorHiddenFor, setAuthorHiddenFor] = React.useState<string | null>(null);

  if (!issue || !detail.status) {
    if (detail.loading) return <RecordSkeleton />;
    return <RecordError message={detail.error || t("ui.issue.notFound")} onRetry={() => void detail.loadIssue(true)} />;
  }

  const authorVisible = authorHiddenFor !== issue.id;
  const notice = getIssueNotice(issue, t(statusLabelKey("issue", issue.status)));
  const actions: RecordAction[] = detail.canManageIssue
    ? [{ icon: ShieldCheck, label: t("ui.issue.manageStatus"), onSelect: () => detail.setModerationOpen(true) }]
    : [];

  return (
    <article className="grid gap-6">
      <RecordHeader
        actions={
          <RecordActions
            items={actions}
            remove={issue.canDeleteIssue || detail.canManageIssue ? {
              description: t("ui.issue.deleteDescription"),
              label: t("ui.issue.delete"),
              onConfirm: () => void detail.remove(),
              status: detail.deleteFeedbackState,
              title: t("ui.issue.deleteTitle"),
            } : undefined}
            shareTitle={issue.title}
          />
        }
        chips={<><StatusChip domain="issue" status={detail.status} /><Chip>{getIssueCategoryLabel(issue.category)}</Chip></>}
        meta={
          <>
            <span>{formatDate(issue.createdAt)}</span>
            {issue.canViewAuthor && authorVisible ? <Author profile={detail.profile} /> : null}
            {detail.canManageIssue && issue.canViewAuthor ? (
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
                {t("issue.showAuthor")}
                <Switch checked={authorVisible} onCheckedChange={(visible) => setAuthorHiddenFor(visible ? null : issue.id)} />
              </label>
            ) : null}
          </>
        }
        title={issue.title}
      />
      {issue.content?.trim() ? <Markdown content={issue.content} fallbackAlt={issue.title} /> : null}
      {notice ? (
        <ResolutionNotice content={notice.content} fallbackAlt={t("ui.issue.resultAlt", { title: issue.title })} title={t(notice.title)} tone={notice.tone} />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {issue.supportEnabled ? (
          <SupportPanel
            burst={detail.burst}
            canViewSupporters={detail.canViewSupporters}
            issue={issue}
            onLoadSupporters={() => void detail.loadSupporters()}
            onSupport={() => void detail.support()}
            supportOpen={detail.supportOpen}
            supportProgress={detail.supportProgress}
            supporters={detail.supporters}
            supportersError={detail.supportersError}
            supportersLoading={detail.supportersLoading}
            supporting={detail.supporting}
          />
        ) : null}
        <Timeline items={detail.timeline} />
      </div>
      {detail.commentsAvailable ? (
        <Discussion
          categoryId={issue.category}
          comments={detail.comments}
          enabled={detail.commentsEnabled}
          error={detail.commentsError}
          hasMore={detail.commentsHaveMore}
          key={`issue:${issue.id}`}
          loading={detail.commentsLoading}
          loadingMore={detail.commentsLoadingMore}
          onCreate={detail.createIssueComment}
          onDelete={detail.removeIssueComment}
          onLoadMore={detail.loadMoreComments}
          onRetry={detail.reloadComments}
          onSortChange={detail.setCommentSort}
          sort={detail.commentSort}
          targetKey={`issue:${issue.id}`}
        />
      ) : null}
      {detail.canManageIssue ? (
        <ModerationSheet issue={issue} onOpenChange={detail.setModerationOpen} onUpdated={detail.setIssue} open={detail.moderationOpen} />
      ) : null}
    </article>
  );
}
