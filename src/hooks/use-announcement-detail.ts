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
  peekAnnouncementRecordById,
  setAnnouncementLike,
} from "@/services/announcements";
import {
  fetchUserPublicProfiles,
  getCachedUserPublicProfiles,
} from "@/services/users-read";
import type {
  AnnouncementCommentRecord,
  AnnouncementRecord,
  CommentSortOption,
  UserPublicProfile,
} from "@/types";
import {
  beginContentEntityRead,
  getDetailContentEntity,
  mergeContentEntityRead,
  patchContentEntity,
} from "@/lib/content-entity-store";
import { useContentEntity } from "@/hooks/use-content-entity";
import { useContentInvalidationRefresh } from "@/hooks/use-content-invalidation-refresh";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { waitForMinimumSkeletonDuration } from "@/lib/loading-timing";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";
import { toggleReactionState } from "@/lib/reaction-state";

export function useAnnouncementDetail() {
  const params = useParams<{ announcementId: string }>();
  const router = useRouter();
  const session = useSession();
  const categories = useCategories();
  const { t } = useI18n();
  const storedAnnouncement = useContentEntity<AnnouncementRecord>(
    session.user?.uid,
    "announcement",
    params.announcementId,
    "detail",
  );
  const currentAnnouncement = storedAnnouncement ?? peekAnnouncementRecordById(
    params.announcementId,
    session.user?.uid,
  );
  const [comments, setComments] = React.useState<AnnouncementCommentRecord[]>([]);
  const [commentSort, setCommentSort] = React.useState<CommentSortOption>("newest");
  const [commentCursor, setCommentCursor] = React.useState<CommentCursor>(null);
  const [commentsHaveMore, setCommentsHaveMore] = React.useState(false);
  const [profile, setProfile] = React.useState<UserPublicProfile | null>(() =>
    currentAnnouncement?.author_uid
      ? getCachedUserPublicProfiles([currentAnnouncement.author_uid])[currentAnnouncement.author_uid] ?? null
      : null,
  );
  const [coldRead] = React.useState(() => !currentAnnouncement);
  const [loading, setLoading] = React.useState(!currentAnnouncement);
  const revealDetail = useColdDataReveal(coldRead, loading);
  const [commentsLoading, setCommentsLoading] = React.useState(true);
  const [commentsLoadingMore, setCommentsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState("");
  const [liking, setLiking] = React.useState(false);
  const likingRef = React.useRef(false);
  const [burst, setBurst] = React.useState(0);
  const deleteFeedback = useActionFeedback();
  const deletingRef = React.useRef(false);

  const load = React.useCallback(
    async (forceRefresh = false) => {
      const cached =
        getDetailContentEntity<AnnouncementRecord>(session.user?.uid, "announcement", params.announcementId) ??
        peekAnnouncementRecordById(params.announcementId, session.user?.uid);
      const coldRead = !cached;
      const startedAt = Date.now();
      if (coldRead) setLoading(true);
      setError("");
      const entityReadRevision = beginContentEntityRead();
      try {
        const result = await fetchAnnouncementRecordById(params.announcementId, {
          cacheScope: session.user?.uid,
          forceRefresh,
        });
        mergeContentEntityRead(
          session.user?.uid,
          "announcement",
          result,
          entityReadRevision,
        );
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
        if (coldRead) await waitForMinimumSkeletonDuration(startedAt);
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
          commentSort,
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
    [commentSort, params.announcementId, session.user?.uid],
  );

  React.useEffect(() => {
    void Promise.all([load(), loadComments()]);
  }, [load, loadComments]);

  const announcementCachePrefixes = React.useMemo(
    () => [`announcement-detail|${params.announcementId}|`],
    [params.announcementId],
  );
  useContentInvalidationRefresh(announcementCachePrefixes, () => {
    if (!deletingRef.current) return load(true);
  });

  async function like() {
    if (!currentAnnouncement || likingRef.current) return;
    const previous = {
      active: currentAnnouncement.currentUserLiked,
      count: currentAnnouncement.like_count,
    };
    const optimistic = toggleReactionState(previous);
    likingRef.current = true;
    setLiking(true);
    patchContentEntity<AnnouncementRecord>(
      session.user?.uid,
      "announcement",
      currentAnnouncement.id,
      {
        currentUserLiked: optimistic.active,
        like_count: optimistic.count,
      },
    );
    if (optimistic.active) setBurst((value) => value + 1);
    try {
      const result = await setAnnouncementLike(
        currentAnnouncement.id,
        optimistic.active,
      );
      patchContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        currentAnnouncement.id,
        {
          currentUserLiked: result.liked,
          like_count: result.like_count,
        },
      );
    } catch {
      patchContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        currentAnnouncement.id,
        {
          currentUserLiked: previous.active,
          like_count: previous.count,
        },
      );
      toast.error(t("ui.announcement.likeFailed"));
    } finally {
      likingRef.current = false;
      setLiking(false);
    }
  }

  async function remove() {
    if (!currentAnnouncement) return;
    deletingRef.current = true;
    try {
      await deleteFeedback.run(async () => {
        await deleteAnnouncement(currentAnnouncement.id);
        patchContentEntity<AnnouncementRecord>(
          session.user?.uid,
          "announcement",
          currentAnnouncement.id,
          { deleting: true },
        );
      });
      toast.success(t("announcement.announcementHasBeenDeleted"));
      router.replace("/announcements");
    } catch (caught) {
      patchContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        currentAnnouncement.id,
        { deleting: false },
      );
      toast.error(caught instanceof Error ? caught.message : t("ui.common.operationFailed"));
      deletingRef.current = false;
    }
  }

  async function createComment(content: string, parentId: string | null) {
    await createAnnouncementComment(params.announcementId, content, parentId);
    await loadComments(true);
    if (currentAnnouncement)
      patchContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        currentAnnouncement.id,
        { comment_count: currentAnnouncement.comment_count + 1 },
      );
  }

  async function removeComment(commentId: string) {
    const result = await deleteAnnouncementComment(commentId);
    await loadComments(true);
    if (currentAnnouncement)
      patchContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        currentAnnouncement.id,
        { comment_count: result.comment_count },
      );
  }

  async function loadMoreComments() {
    if (!commentsHaveMore || !commentCursor || commentsLoadingMore) return;
    setCommentsLoadingMore(true);
    try {
      const result = await fetchAnnouncementComments(
        params.announcementId,
        commentCursor,
        commentSort,
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
    announcement: currentAnnouncement,
    burst,
    canManage: session.can("announcement.manage"),
    comments,
    commentSort,
    commentsEnabled:
      Boolean(currentAnnouncement?.comments_enabled) &&
      categories.announcementCommentsEnabled,
    commentsHaveMore,
    commentsLoading,
    commentsLoadingMore,
    createComment,
    deleteFeedbackState: deleteFeedback.state,
    error,
    like,
    liking,
    load,
    loading,
    revealDetail,
    loadMoreComments,
    profile,
    setCommentSort,
    remove,
    removeComment,
  };
}
