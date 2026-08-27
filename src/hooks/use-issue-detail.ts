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
import type { CommentCursor } from "@/services/comment-cursor";
import {
  createComment,
  deleteComment,
  deleteIssue,
  fetchComments,
  fetchIssueRecordById,
  peekIssueRecordById,
  toggleSupport,
} from "@/services/issues";
import {
  fetchUserPublicProfiles,
  getCachedUserPublicProfiles,
} from "@/services/users-read";
import type { CommentRecord, CommentSortOption, IssueRecord, UserPublicProfile } from "@/types";
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
import { toggleReactionState } from "@/lib/reaction-state";

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
  const [comments, setComments] = React.useState<CommentRecord[]>([]);
  const [commentSort, setCommentSort] = React.useState<CommentSortOption>("newest");
  const [commentCursor, setCommentCursor] = React.useState<CommentCursor>(null);
  const [commentsHaveMore, setCommentsHaveMore] = React.useState(false);
  const [profile, setProfile] = React.useState<UserPublicProfile | null>(() =>
    currentIssue?.author_uid
      ? getCachedUserPublicProfiles([currentIssue.author_uid])[currentIssue.author_uid] ?? null
      : null,
  );
  const [coldRead] = React.useState(() => !currentIssue);
  const [loading, setLoading] = React.useState(!currentIssue);
  const revealDetail = useColdDataReveal(coldRead, loading);
  const [commentsLoading, setCommentsLoading] = React.useState(true);
  const [commentsLoadingMore, setCommentsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [supporting, setSupporting] = React.useState(false);
  const supportingRef = React.useRef(false);
  const [burst, setBurst] = React.useState(0);
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
          forceRefresh,
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
  const loadComments = React.useCallback(
    async (forceRefresh = false) => {
      if (!commentsReadable) {
        setCommentsLoading(false);
        return;
      }
      setCommentsLoading(true);
      try {
        const result = await fetchComments(issueId, null, commentSort, {
          cacheScope: session.user?.uid,
          forceRefresh,
        });
        setComments(result.comments);
        setCommentCursor(result.cursor);
        setCommentsHaveMore(result.hasMore);
      } finally {
        setCommentsLoading(false);
      }
    },
    [commentSort, commentsReadable, issueId, session.user?.uid],
  );

  React.useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function loadMoreComments() {
    if (!commentsHaveMore || !commentCursor || commentsLoadingMore) return;
    setCommentsLoadingMore(true);
    try {
      const result = await fetchComments(issueId, commentCursor, commentSort, {
        cacheScope: session.user?.uid,
      });
      setComments((current) => [
        ...current,
        ...result.comments.filter(
          (comment) => !current.some((existing) => existing.id === comment.id),
        ),
      ]);
      setCommentCursor(result.cursor);
      setCommentsHaveMore(result.hasMore);
    } finally {
      setCommentsLoadingMore(false);
    }
  }

  async function support() {
    if (!currentIssue || currentIssue.isOwnIssue || supportingRef.current) return;
    const previous = {
      active: currentIssue.currentUserSupported === true,
      count: currentIssue.support_count,
    };
    const optimistic = toggleReactionState(previous);
    supportingRef.current = true;
    setSupporting(true);
    patchContentEntity<IssueRecord>(
      session.user?.uid,
      "issue",
      currentIssue.id,
      {
        currentUserSupported: optimistic.active,
        support_count: optimistic.count,
      },
    );
    rememberSupportedIssue(currentIssue.id, optimistic.active);
    if (optimistic.active) setBurst((value) => value + 1);
    try {
      const result = await toggleSupport(currentIssue.id);
      patchContentEntity<IssueRecord>(
        session.user?.uid,
        "issue",
        currentIssue.id,
        {
          currentUserSupported: result.supported,
          support_count: result.support_count,
        },
      );
      rememberSupportedIssue(currentIssue.id, result.supported);
    } catch {
      patchContentEntity<IssueRecord>(
        session.user?.uid,
        "issue",
        currentIssue.id,
        {
          currentUserSupported: previous.active,
          support_count: previous.count,
        },
      );
      rememberSupportedIssue(currentIssue.id, previous.active);
      toast.error(t("ui.issue.supportFailed"));
    } finally {
      supportingRef.current = false;
      setSupporting(false);
    }
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
    await loadComments(true);
  }

  async function removeIssueComment(commentId: string) {
    await deleteComment(commentId);
    await loadComments(true);
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
    burst,
    comments,
    commentSort,
    commentsAvailable,
    commentsEnabled,
    commentsHaveMore,
    commentsHighlighted: search.get("tab") === "comments",
    commentsLoading,
    commentsLoadingMore,
    createIssueComment,
    deleteFeedbackState: deleteFeedback.state,
    error,
    issue: currentIssue,
    loadIssue,
    loading,
    revealDetail,
    loadMoreComments,
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
    setCommentSort,
    setModerationOpen,
    status: currentIssue ? getDerivedIssueStatus(currentIssue) : null,
    canManageIssue: currentIssue
      ? session.canManageIssueCategory(currentIssue.category)
      : false,
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
    supporting,
    timeline: currentIssue ? getIssueOperationTimeItems(currentIssue) : [],
  };
}
