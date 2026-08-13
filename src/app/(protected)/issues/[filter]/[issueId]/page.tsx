"use client";

import { useI18n } from "@/i18n";
import { useIssueDetail } from "@/hooks/use-issue-detail";
import { Discussion } from "@/components/discussion";
import {
  IssueDetailSidebar,
  IssueDetailToolbar,
} from "@/components/issues/issue-detail-actions";
import { IssueDetailContent } from "@/components/issues/issue-detail-content";
import { IssueModerationDialog } from "@/components/issues/issue-moderation-dialog";
import { ErrorState } from "@/components/ui/page-state";
import { DetailRouteSkeleton } from "@/components/ui/route-skeleton";

export default function IssueDetailPage() {
  const { t } = useI18n();
  const detail = useIssueDetail();
  if (detail.loading) return <DetailRouteSkeleton />;
  if (detail.error || !detail.issue || !detail.status) {
    return (
      <ErrorState
        error={detail.error || t("ui.issue.notFound")}
        onRetry={() => void detail.loadIssue(true)}
      />
    );
  }
  return (
    <div className="t-reveal-content space-y-5">
      <IssueDetailToolbar
        issue={detail.issue}
        onBack={detail.back}
        onDelete={() => void detail.remove()}
        onManage={() => detail.setModerationOpen(true)}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
        <article className="space-y-4">
          <IssueDetailContent
            issue={detail.issue}
            profile={detail.profile}
            status={detail.status}
          />
          <div className={detail.commentsHighlighted ? "t-panel-reveal" : ""}>
            <Discussion
              comments={detail.comments}
              enabled={detail.commentsEnabled}
              hasMore={detail.commentsHaveMore}
              loading={detail.commentsLoading}
              loadingMore={detail.commentsLoadingMore}
              onCreate={detail.createIssueComment}
              onDelete={detail.removeIssueComment}
              onLoadMore={detail.loadMoreComments}
            />
          </div>
        </article>
        <IssueDetailSidebar
          burst={detail.burst}
          issue={detail.issue}
          onSupport={() => void detail.support()}
          supportOpen={detail.supportOpen}
          supportProgress={detail.supportProgress}
          supporting={detail.supporting}
          timeline={detail.timeline}
        />
      </div>
      <IssueModerationDialog
        issue={detail.issue}
        onOpenChange={detail.setModerationOpen}
        onUpdated={detail.setIssue}
        open={detail.moderationOpen}
      />
    </div>
  );
}
