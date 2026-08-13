"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import type { CommentCursor } from "@/services/comment-cursor";
import {
  createAnnouncementComment,
  deleteAnnouncement,
  deleteAnnouncementComment,
  fetchAnnouncementComments,
  fetchAnnouncementRecordById,
  setAnnouncementLike,
} from "@/services/announcements";
import { fetchUserPublicProfiles } from "@/services/users-read";
import type {
  AnnouncementCommentRecord,
  AnnouncementRecord,
  UserPublicProfile,
} from "@/types";
import { reconcileReactionState, recordReactionMutation } from "@/lib/reaction-state";

export function useAnnouncementDetail() {
  const params = useParams<{ announcementId: string }>();
  const router = useRouter();
  const session = useSession();
  const categories = useCategories();
  const { t } = useI18n();
  const [announcement, setAnnouncement] =
    React.useState<AnnouncementRecord | null>(null);
  const [comments, setComments] = React.useState<AnnouncementCommentRecord[]>([]);
  const [commentCursor, setCommentCursor] = React.useState<CommentCursor>(null);
  const [commentsHaveMore, setCommentsHaveMore] = React.useState(false);
  const [profile, setProfile] = React.useState<UserPublicProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [commentsLoading, setCommentsLoading] = React.useState(true);
  const [commentsLoadingMore, setCommentsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [liking, setLiking] = React.useState(false);
  const [burst, setBurst] = React.useState(0);

  const load = React.useCallback(
    async (forceRefresh = false) => {
      setLoading(true);
      setError("");
      try {
        const result = await fetchAnnouncementRecordById(params.announcementId, {
          cacheScope: session.user?.uid,
          forceRefresh,
        });
        const reaction = reconcileReactionState(
          session.user?.uid,
          "announcement",
          result.id,
          { active: result.currentUserLiked, count: result.like_count },
          "detail",
        );
        setAnnouncement({
          ...result,
          currentUserLiked: reaction.active,
          like_count: reaction.count,
        });
        void fetchUserPublicProfiles([result.author_uid])
          .then((profiles) => setProfile(profiles[result.author_uid] ?? null))
          .catch(() => undefined);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : t("ui.announcement.notFound"),
        );
      } finally {
        setLoading(false);
      }
    },
    [params.announcementId, session.user?.uid, t],
  );

  const loadComments = React.useCallback(
    async (forceRefresh = false) => {
      setCommentsLoading(true);
      try {
        const result = await fetchAnnouncementComments(
          params.announcementId,
          undefined,
          { cacheScope: session.user?.uid, forceRefresh },
        );
        setComments(result.comments);
        setCommentCursor(result.cursor);
        setCommentsHaveMore(result.hasMore);
      } catch {
        // The announcement remains available when its discussion cannot load.
      } finally {
        setCommentsLoading(false);
      }
    },
    [params.announcementId, session.user?.uid],
  );

  React.useEffect(() => {
    void Promise.all([load(), loadComments()]);
  }, [load, loadComments]);

  async function like() {
    if (!announcement || liking) return;
    setLiking(true);
    try {
      const result = await setAnnouncementLike(
        announcement.id,
        !announcement.currentUserLiked,
      );
      recordReactionMutation(session.user?.uid, "announcement", announcement.id, {
        active: result.liked,
        count: result.like_count,
      });
      setAnnouncement({
        ...announcement,
        currentUserLiked: result.liked,
        like_count: result.like_count,
      });
      setBurst((value) => value + 1);
    } catch (caught) {
      toast.error(
        caught instanceof Error ? caught.message : t("ui.common.operationFailed"),
      );
    } finally {
      setLiking(false);
    }
  }

  async function remove() {
    if (!announcement) return;
    await deleteAnnouncement(announcement.id);
    toast.success(t("ui.announcement.deleted"));
    router.replace("/announcements");
  }

  async function createComment(content: string, parentId: string | null) {
    await createAnnouncementComment(params.announcementId, content, parentId);
    await loadComments(true);
    setAnnouncement((current) =>
      current ? { ...current, comment_count: current.comment_count + 1 } : current,
    );
  }

  async function removeComment(commentId: string) {
    const result = await deleteAnnouncementComment(commentId);
    await loadComments(true);
    setAnnouncement((current) =>
      current ? { ...current, comment_count: result.comment_count } : current,
    );
  }

  async function loadMoreComments() {
    if (!commentsHaveMore || !commentCursor || commentsLoadingMore) return;
    setCommentsLoadingMore(true);
    try {
      const result = await fetchAnnouncementComments(
        params.announcementId,
        commentCursor,
        { cacheScope: session.user?.uid },
      );
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

  return {
    announcement,
    burst,
    canManage: session.can("announcement.manage"),
    comments,
    commentsEnabled:
      Boolean(announcement?.comments_enabled) &&
      categories.announcementCommentsEnabled,
    commentsHaveMore,
    commentsLoading,
    commentsLoadingMore,
    createComment,
    error,
    like,
    liking,
    load,
    loading,
    loadMoreComments,
    profile,
    remove,
    removeComment,
  };
}
