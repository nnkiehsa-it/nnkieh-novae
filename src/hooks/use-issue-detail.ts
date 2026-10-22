import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAppLocation, useAppNavigate, useRecordId } from "@/hooks/use-app-location";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import {
  issueAllowsCommentsForStatus,
  issueCategoryAllowsComments,
} from "@/constants/categories";
import { useSession } from "@/hooks/use-session";
import { getDerivedIssueStatus, getSupportProgressPercent } from "@/lib/issue-status";
import { getIssueOperationTimeItems } from "@/lib/issue-timeline";
import { useCommentFeed } from "@/hooks/use-comment-feed";
import {
  createComment,
  deleteComment,
  deleteIssue,
  getIssue,
  issueKeys,
  listComments,
  listIssueSupporters,
  setSupport,
} from "@/services/issues";
import type { IssueRecord } from "@/types";
import type { Issue } from "@shared/contracts/issues.ts";
import { dropEntity, patchEntity } from "@/lib/query-client";
import { usePublicProfiles } from "@/hooks/use-public-profiles";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { feedHref } from "@/lib/feed-href";
import { useOptimisticReaction } from "@/hooks/use-optimistic-reaction";

export function useIssueDetail() {
  const { filter, id: issueId } = useRecordId("issue");
  const { search } = useAppLocation();
  const navigate = useAppNavigate();
  const session = useSession();
  const { t } = useI18n();
  const [deleting, setDeleting] = React.useState(false);
  const query = useQuery({
    // A proposal being deleted is not read again while the screen leaves it.
    enabled: !deleting,
    queryKey: issueKeys.detail(issueId),
    queryFn: ({ signal }) => getIssue(issueId, signal),
  });
  const currentIssue = query.data;
  const authorUid = currentIssue?.authorUid;
  const profile = usePublicProfiles([authorUid])[authorUid ?? ""] ?? null;
  const [supporters, setSupporters] = React.useState<
    Awaited<ReturnType<typeof listIssueSupporters>>
  >([]);
  const [supportersLoading, setSupportersLoading] = React.useState(false);
  const [supportersError, setSupportersError] = React.useState("");
  const reaction = useOptimisticReaction();
  const [moderationOpen, setModerationOpen] = React.useState(false);
  const deleteFeedback = useActionFeedback();

  const canViewSupporters = Boolean(
    currentIssue?.supportEnabled
      && (currentIssue.isOwnIssue || session.canManageIssueCategory(currentIssue.category)),
  );
  // Nobody pays for the identity read until they ask who the supporters are.
  const supportersAsked = React.useRef(false);
  const loadSupporters = React.useCallback(async () => {
    if (!canViewSupporters) return;
    supportersAsked.current = true;
    setSupportersLoading(true);
    setSupportersError("");
    try {
      setSupporters(await listIssueSupporters(issueId));
    } catch (caught) {
      setSupportersError(
        caught instanceof Error ? caught.message : t("ui.common.loadFailed"),
      );
    } finally {
      setSupportersLoading(false);
    }
  }, [canViewSupporters, issueId, t]);

  const commentsAvailable = Boolean(
    currentIssue &&
      currentIssue.commentsEnabled &&
      issueCategoryAllowsComments(currentIssue.category),
  );
  const commentsReadable = Boolean(
    currentIssue &&
      commentsAvailable &&
      currentIssue.status !== "under-review" &&
      currentIssue.status !== "review-rejected",
  );
  const commentFeed = useCommentFeed({
    enabled: commentsReadable,
    queryKey: (sort) => issueKeys.comments(issueId, sort),
    read: (cursor, sort, signal) => listComments(issueId, cursor, sort, signal),
  });

  async function support() {
    if (!currentIssue || currentIssue.isOwnIssue) return;
    return reaction.run({
      id: currentIssue.id,
      previous: { active: currentIssue.currentUserSupported, count: currentIssue.supportCount },
      apply: ({ active, count }) =>
        patchEntity<IssueRecord>("issues", currentIssue.id, { currentUserSupported: active, supportCount: count }),
      request: async (active) => {
        const result = await setSupport(currentIssue.id, active);
        return { active: result.supported, count: result.supportCount };
      },
      onSuccess: () => { if (supportersAsked.current) void loadSupporters(); },
      errorMessage: t("ui.issue.supportFailed"),
    });
  }

  async function remove() {
    if (!currentIssue) return;
    setDeleting(true);
    try {
      await deleteFeedback.run(() => deleteIssue(currentIssue.id));
      dropEntity("issues", currentIssue.id);
      toast.success(t("issue.proposalDeleted"));
      navigate(feedHref("issues", filter), { replace: true });
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      setDeleting(false);
    }
  }

  const commentsEnabled = Boolean(
    currentIssue &&
      commentsReadable &&
      issueAllowsCommentsForStatus(
        currentIssue.readAccess,
        currentIssue.status,
      ),
  );

  return {
    burst: reaction.burstById[issueId] ?? 0,
    comments: commentFeed.comments,
    commentSort: commentFeed.sort,
    commentsAvailable,
    commentsEnabled,
    commentsHaveMore: commentFeed.hasMore,
    commentsHighlighted: search.get("tab") === "comments",
    commentsLoading: commentFeed.loading,
    commentsLoadingMore: commentFeed.loadingMore,
    commentsError: commentFeed.error,
    reloadComments: commentFeed.reload,
    createIssueComment: async (content: string, parentCommentId: string | null) => {
      await createComment(issueId, content, parentCommentId);
    },
    deleteFeedbackState: deleteFeedback.state,
    error: query.error ? query.error.message || t("ui.issue.notFound") : "",
    issue: currentIssue,
    reload: () => void query.refetch(),
    loading: query.isLoading,
    loadMoreComments: commentFeed.loadMore,
    moderationOpen,
    profile,
    remove,
    removeIssueComment: async (commentId: string) => {
      await deleteComment(issueId, commentId);
    },
    setIssue: (next: Issue) => {
      patchEntity<IssueRecord>("issues", next.id, next);
    },
    setCommentSort: commentFeed.setSort,
    setModerationOpen,
    status: currentIssue ? getDerivedIssueStatus(currentIssue) : null,
    canManageIssue: currentIssue
      ? session.canManageIssueCategory(currentIssue.category)
      : false,
    canViewSupporters,
    loadSupporters,
    supporters,
    supportersError,
    supportersLoading,
    support,
    supportOpen: Boolean(
      currentIssue?.supportEnabled &&
        !currentIssue.isOwnIssue &&
        (currentIssue.status === "pending" ||
          currentIssue.status === "processing"),
    ),
    supportProgress: currentIssue
      ? getSupportProgressPercent(
          currentIssue.supportCount,
          currentIssue.supportGoal,
        )
      : 0,
    supporting: reaction.isBusy(issueId),
    timeline: currentIssue ? getIssueOperationTimeItems(currentIssue) : [],
  };
}
