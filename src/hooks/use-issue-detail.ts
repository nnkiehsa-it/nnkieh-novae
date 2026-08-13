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
import { getDerivedIssueStatus, getSupportProgressPercent } from "@/lib/issue-status";
import { getIssueOperationTimeItems } from "@/lib/issue-timeline";
import type { CommentCursor } from "@/services/comment-cursor";
import {
  createComment,
  deleteComment,
  deleteIssue,
  fetchComments,
  fetchIssueRecordById,
  toggleSupport,
} from "@/services/issues";
import { fetchUserPublicProfiles } from "@/services/users-read";
import type { CommentRecord, IssueRecord, UserPublicProfile } from "@/types";

export function useIssueDetail() {
  const params = useParams<{ filter: string; issueId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const session = useSession();
  const { t } = useI18n();
  const issueId = params.issueId;
  const filter = decodeURIComponent(params.filter);
  const [issue, setIssue] = React.useState<IssueRecord | null>(null);
  const [comments, setComments] = React.useState<CommentRecord[]>([]);
  const [commentCursor, setCommentCursor] = React.useState<CommentCursor>(null);
  const [commentsHaveMore, setCommentsHaveMore] = React.useState(false);
  const [profile, setProfile] = React.useState<UserPublicProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [commentsLoading, setCommentsLoading] = React.useState(true);
  const [commentsLoadingMore, setCommentsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [supporting, setSupporting] = React.useState(false);
  const [burst, setBurst] = React.useState(0);
  const [moderationOpen, setModerationOpen] = React.useState(false);

  const loadIssue = React.useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchIssueRecordById(issueId, {
          cacheScope: session.user?.uid,
          forceRefresh,
        });
        setIssue(result);
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

  const commentsReadable = Boolean(
    issue && issue.status !== "under-review" && issue.status !== "review-rejected",
  );
  const loadComments = React.useCallback(
    async (forceRefresh = false) => {
      if (!commentsReadable) {
        setCommentsLoading(false);
        return;
      }
      setCommentsLoading(true);
      try {
        const result = await fetchComments(issueId, null, {
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
    [commentsReadable, issueId, session.user?.uid],
  );

  React.useEffect(() => {
    void loadComments();
  }, [loadComments]);

  async function loadMoreComments() {
    if (!commentsHaveMore || !commentCursor || commentsLoadingMore) return;
    setCommentsLoadingMore(true);
    try {
      const result = await fetchComments(issueId, commentCursor, {
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
    if (!issue || supporting) return;
    setSupporting(true);
    try {
      const result = await toggleSupport(issue.id);
      setIssue({
        ...issue,
        currentUserSupported: result.supported,
        support_count: result.support_count,
      });
      session.setSupportedIssue(issue.id, result.supported);
      setBurst((value) => value + 1);
      toast.success(
        result.supported ? t("ui.issue.supported") : t("ui.issue.unsupported"),
      );
    } catch (caught) {
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
    } finally {
      setSupporting(false);
    }
  }

  async function remove() {
    if (!issue) return;
    await deleteIssue(issue.id);
    toast.success(t("ui.notification.issueDeleted"));
    router.replace(`/issues/${encodeURIComponent(filter)}`);
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
    issue &&
      commentsReadable &&
      issue.comments_enabled &&
      issueCategoryAllowsComments(issue.category) &&
      issueAllowsCommentsForStatus(issue.read_access, issue.status),
  );

  return {
    back: () => router.push(`/issues/${encodeURIComponent(filter)}`),
    burst,
    comments,
    commentsEnabled,
    commentsHaveMore,
    commentsHighlighted: search.get("tab") === "comments",
    commentsLoading,
    commentsLoadingMore,
    createIssueComment,
    error,
    issue,
    loadIssue,
    loading,
    loadMoreComments,
    moderationOpen,
    profile,
    remove,
    removeIssueComment,
    setIssue,
    setModerationOpen,
    status: issue ? getDerivedIssueStatus(issue) : null,
    support,
    supportOpen: Boolean(
      issue?.support_enabled &&
        (issue.status === "pending" || issue.status === "processing"),
    ),
    supportProgress: issue
      ? getSupportProgressPercent(issue.support_count, issue.support_goal)
      : 0,
    supporting,
    timeline: issue ? getIssueOperationTimeItems(issue) : [],
  };
}
