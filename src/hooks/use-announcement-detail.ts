"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import { useCommentFeed, type CommentPageRequest } from "@/hooks/use-comment-feed";
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
  const [profile, setProfile] = React.useState<UserPublicProfile | null>(() =>
    currentAnnouncement?.author_uid
      ? getCachedUserPublicProfiles([currentAnnouncement.author_uid])[currentAnnouncement.author_uid] ?? null
      : null,
  );
  const [coldRead] = React.useState(() => !currentAnnouncement);
  const [loading, setLoading] = React.useState(!currentAnnouncement);
  const revealDetail = useColdDataReveal(coldRead, loading);
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
        setLoading(false);
      }
    },
    [params.announcementId, session.user?.uid, t],
  );

  const commentsEnabled = Boolean(currentAnnouncement?.comments_enabled) && categories.announcementCommentsEnabled;
  const fetchCommentPage = React.useCallback(
    ({ cursor, sort, forceRefresh, onPage }: CommentPageRequest<AnnouncementCommentRecord>) =>
      fetchAnnouncementComments(params.announcementId, cursor, sort, {
        cacheScope: session.user?.uid, forceRefresh, onPage,
      }),
    [params.announcementId, session.user?.uid],
  );
  const commentFeed = useCommentFeed({
    enabled: categories.announcementCommentsEnabled && currentAnnouncement?.comments_enabled !== false,
    targetKey: `${session.user?.uid}|announcement:${params.announcementId}`,
    fetchPage: fetchCommentPage,
  });

  React.useEffect(() => {
    void load();
  }, [load]);

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
    } catch (caught) {
      patchContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        currentAnnouncement.id,
        {
          currentUserLiked: previous.active,
          like_count: previous.count,
        },
      );
      toast.error(caught instanceof Error ? caught.message : t("ui.announcement.likeFailed"));
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
    const result = await createAnnouncementComment(params.announcementId, content, parentId);
    if (currentAnnouncement)
      patchContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        currentAnnouncement.id,
        { comment_count: result.comment_count },
      );
    await commentFeed.load(true);
  }

  async function removeComment(commentId: string) {
    const result = await deleteAnnouncementComment(commentId);
    if (currentAnnouncement)
      patchContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        currentAnnouncement.id,
        { comment_count: result.comment_count },
      );
    await commentFeed.load(true);
  }

  return {
    announcement: currentAnnouncement,
    burst,
    canManage: session.can("announcement.manage"),
    comments: commentFeed.comments,
    commentSort: commentFeed.sort,
    commentsEnabled,
    commentsHaveMore: commentFeed.hasMore,
    commentsLoading: commentFeed.loading,
    commentsLoadingMore: commentFeed.loadingMore,
    commentsError: commentFeed.error,
    reloadComments: () => commentFeed.load(true),
    createComment,
    deleteFeedbackState: deleteFeedback.state,
    error,
    like,
    liking,
    load,
    loading,
    revealDetail,
    loadMoreComments: commentFeed.loadMore,
    profile,
    setCommentSort: commentFeed.setSort,
    remove,
    removeComment,
  };
}
