"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import {
  issueAllowsCommentsForStatus,
  issueCategoryAllowsComments,
} from "@/constants/categories";
import { useSession } from "@/hooks/use-session";
import { rememberSupportedIssue } from "@/lib/supported-issue-memory";
import { getDerivedIssueStatus, getSupportProgressPercent } from "@/lib/issue-status";
import { getIssueOperationTimeItems } from "@/lib/issue-timeline";
import { useCommentFeed, type CommentPageRequest } from "@/hooks/use-comment-feed";
import {
  createComment,
  deleteComment,
  deleteIssue,
  fetchComments,
  fetchIssueRecordById,
  fetchIssueSupporters,
  peekIssueRecordById,
  removeSupport,
  toggleSupport,
} from "@/services/issues";
import {
  fetchUserPublicProfiles,
  getCachedUserPublicProfiles,
} from "@/services/users-read";
import type { CommentRecord, IssueRecord, UserPublicProfile } from "@/types";
import {
  beginContentEntityRead,
  getDetailContentEntity,
  mergeContentEntityRead,
  patchContentEntity,
} from "@/lib/content-entity-store";
import { useContentEntity } from "@/hooks/use-content-entity";
import { useContentInvalidationRefresh } from "@/hooks/use-content-invalidation-refresh";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { returnToPreviousRoute } from "@/lib/navigation-memory";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";
import { useOptimisticReaction } from "@/hooks/use-optimistic-reaction";

export function useIssueDetail() {
  const params = useParams<{ filter: string; issueId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const { t } = useI18n();
  const issueId = params.issueId;
  const filter = decodeURIComponent(params.filter);
  const storedIssue = useContentEntity<IssueRecord>(
    session.user?.uid,
    "issue",
    issueId,
    "detail",
  );
  const currentIssue = storedIssue ?? peekIssueRecordById(issueId, session.user?.uid);
  const [profile, setProfile] = React.useState<UserPublicProfile | null>(() =>
    currentIssue?.author_uid
      ? getCachedUserPublicProfiles([currentIssue.author_uid])[currentIssue.author_uid] ?? null
      : null,
  );
  const [supporters, setSupporters] = React.useState<
    Awaited<ReturnType<typeof fetchIssueSupporters>>
  >([]);
  const [supportersLoading, setSupportersLoading] = React.useState(false);
  const [supportersError, setSupportersError] = React.useState("");
  const [coldRead] = React.useState(() => !currentIssue);
  const [loading, setLoading] = React.useState(!currentIssue);
  const revealDetail = useColdDataReveal(coldRead, loading);
  const [error, setError] = React.useState("");
  const reaction = useOptimisticReaction(session.user?.uid, "issue");
  const [moderationOpen, setModerationOpen] = React.useState(false);
  const deleteFeedback = useActionFeedback();
  const deletingRef = React.useRef(false);

  const loadIssue = React.useCallback(
    async (forceRefresh = false) => {
      const cached =
        getDetailContentEntity<IssueRecord>(session.user?.uid, "issue", issueId) ??
        peekIssueRecordById(issueId, session.user?.uid);
      const coldRead = !cached;
      if (coldRead) setLoading(true);
      setError("");
      const entityReadRevision = beginContentEntityRead();
      try {
        const result = await fetchIssueRecordById(issueId, {
          cacheScope: session.user?.uid,
          forceRefresh: forceRefresh || !coldRead,
        });
        const merged = mergeContentEntityRead(
          session.user?.uid,
          "issue",
          {
          ...result,
            currentUserSupported:
              result.isOwnIssue || result.currentUserSupported === true,
          },
          entityReadRevision,
        );
        rememberSupportedIssue(merged.id, merged.currentUserSupported === true);
        if (result.canViewAuthor && result.author_uid) {
          void fetchUserPublicProfiles([result.author_uid])
            .then((profiles) => setProfile(profiles[result.author_uid!] ?? null))
            .catch(() => undefined);
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : t("ui.issue.notFound"));
      } finally {
        setLoading(false);
      }
    },
    [issueId, session.user?.uid, t],
  );

  React.useEffect(() => {
    void loadIssue();
  }, [loadIssue]);

  const issueCachePrefixes = React.useMemo(
    () => [`issue-detail|${issueId}|`],
    [issueId],
  );
  useContentInvalidationRefresh(issueCachePrefixes, () => {
    if (!deletingRef.current) return loadIssue(true);
  });

  const canViewSupporters = Boolean(
    currentIssue?.support_enabled
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
      setSupporters(await fetchIssueSupporters(issueId));
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
      currentIssue.comments_enabled &&
      issueCategoryAllowsComments(currentIssue.category),
  );
  const commentsReadable = Boolean(
    currentIssue &&
      commentsAvailable &&
      currentIssue.status !== "under-review" &&
      currentIssue.status !== "review-rejected",
  );
  const fetchCommentPage = React.useCallback(
    ({ cursor, sort, forceRefresh }: CommentPageRequest<CommentRecord>) =>
      fetchComments(issueId, cursor, sort, { cacheScope: session.user?.uid, forceRefresh }),
    [issueId, session.user?.uid],
  );
  const commentFeed = useCommentFeed({
    enabled: commentsReadable,
    targetKey: `${session.user?.uid}|issue:${issueId}`,
    fetchPage: fetchCommentPage,
  });

  async function support() {
    if (!currentIssue || currentIssue.isOwnIssue) return;
    return reaction.run({
      id: currentIssue.id,
      previous: { active: currentIssue.currentUserSupported === true, count: currentIssue.support_count },
      apply: ({ active, count }, pending) => {
        patchContentEntity<IssueRecord>(session.user?.uid, "issue", currentIssue.id, { currentUserSupported: active, support_count: count }, { pending });
        rememberSupportedIssue(currentIssue.id, active);
      },
      request: async (active) => {
        const result = active ? await toggleSupport(currentIssue.id) : await removeSupport(currentIssue.id);
        return { active: result.supported, count: result.support_count };
      },
      onSuccess: () => { if (supportersAsked.current) void loadSupporters(); },
      errorMessage: t("ui.issue.supportFailed"),
    });
  }

  async function remove() {
    if (!currentIssue) return;
    deletingRef.current = true;
    try {
      await deleteFeedback.run(async () => {
        await deleteIssue(currentIssue.id);
        patchContentEntity<IssueRecord>(
          session.user?.uid,
          "issue",
          currentIssue.id,
          { deleting: true },
        );
      });
      toast.success(t("issue.proposalDeleted"));
      router.replace(`/issues/${encodeURIComponent(filter)}`);
    } catch (caught) {
      patchContentEntity<IssueRecord>(
        session.user?.uid,
        "issue",
        currentIssue.id,
        { deleting: false },
      );
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      deletingRef.current = false;
    }
  }

  async function createIssueComment(content: string, parentCommentId: string | null) {
    await createComment(issueId, { content }, parentCommentId);
    await commentFeed.load(true);
  }

  async function removeIssueComment(commentId: string) {
    await deleteComment(commentId);
    await commentFeed.load(true);
  }

  const commentsEnabled = Boolean(
    currentIssue &&
      commentsReadable &&
      issueAllowsCommentsForStatus(
        currentIssue.read_access,
        currentIssue.status,
      ),
  );

  return {
    back: () =>
      returnToPreviousRoute(
        router,
        `/issues/${encodeURIComponent(filter)}`,
        "/issues",
      ),
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
    reloadComments: () => commentFeed.load(true),
    createIssueComment,
    deleteFeedbackState: deleteFeedback.state,
    error,
    issue: currentIssue,
    loadIssue,
    loading,
    revealDetail,
    loadMoreComments: commentFeed.loadMore,
    moderationOpen,
    profile,
    remove,
    removeIssueComment,
    setIssue: (next: IssueRecord) => {
      patchContentEntity<IssueRecord>(
        session.user?.uid,
        "issue",
        next.id,
        next,
      );
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
      currentIssue?.support_enabled &&
        !currentIssue.isOwnIssue &&
        (currentIssue.status === "pending" ||
          currentIssue.status === "processing"),
    ),
    supportProgress: currentIssue
      ? getSupportProgressPercent(
          currentIssue.support_count,
          currentIssue.support_goal,
        )
      : 0,
    supporting: reaction.isBusy(issueId),
    timeline: currentIssue ? getIssueOperationTimeItems(currentIssue) : [],
  };
}
