"use client";

import * as React from "react";
import { useAppNavigate, useRecordId } from "@/hooks/use-app-location";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { useCategories } from "@/hooks/use-categories";
import { useSession } from "@/hooks/use-session";
import { useCommentFeed, type CommentPageRequest } from "@/hooks/use-comment-feed";
import {
  createAnnouncementComment,
  deleteAnnouncement,
  deleteAnnouncementComment,
  getAnnouncement,
  listAnnouncementComments,
  peekAnnouncement,
  setAnnouncementLike,
} from "@/services/announcements";
import {
  fetchUserPublicProfiles,
  getCachedUserPublicProfiles,
} from "@/services/users-read";
import type { AnnouncementRecord, UserPublicProfile } from "@/types";
import {
  beginContentEntityRead,
  getDetailContentEntity,
  mergeContentEntityRead,
  patchContentEntity,
} from "@/lib/content-entity-store";
import { useContentEntity } from "@/hooks/use-content-entity";
import { useContentInvalidationRefresh } from "@/hooks/use-content-invalidation-refresh";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { feedHref } from "@/lib/feed-href";
import { useColdDataReveal } from "@/hooks/use-cold-data-reveal";
import { useOptimisticReaction } from "@/hooks/use-optimistic-reaction";

export function useAnnouncementDetail() {
  const { id: announcementId } = useRecordId("announcement");
  const navigate = useAppNavigate();
  const session = useSession();
  const categories = useCategories();
  const { t } = useI18n();
  const storedAnnouncement = useContentEntity<AnnouncementRecord>(
    session.user?.uid,
    "announcement",
    announcementId,
    "detail",
  );
  const currentAnnouncement = storedAnnouncement ?? peekAnnouncement(
    announcementId,
    session.user?.uid,
  );
  const [profile, setProfile] = React.useState<UserPublicProfile | null>(() =>
    currentAnnouncement?.authorUid
      ? getCachedUserPublicProfiles([currentAnnouncement.authorUid])[currentAnnouncement.authorUid] ?? null
      : null,
  );
  const [coldRead] = React.useState(() => !currentAnnouncement);
  const [loading, setLoading] = React.useState(!currentAnnouncement);
  const revealDetail = useColdDataReveal(coldRead, loading);
  const [error, setError] = React.useState("");
  const reaction = useOptimisticReaction(session.user?.uid, "announcement");
  const deleteFeedback = useActionFeedback();
  const deletingRef = React.useRef(false);

  const load = React.useCallback(
    async (forceRefresh = false) => {
      const cached =
        getDetailContentEntity<AnnouncementRecord>(session.user?.uid, "announcement", announcementId) ??
        peekAnnouncement(announcementId, session.user?.uid);
      const coldRead = !cached;
      if (coldRead) setLoading(true);
      setError("");
      const entityReadRevision = beginContentEntityRead();
      try {
        const result = await getAnnouncement(announcementId, {
          cacheScope: session.user?.uid,
          forceRefresh: forceRefresh || !coldRead,
        });
        mergeContentEntityRead(
          session.user?.uid,
          "announcement",
          result,
          entityReadRevision,
        );
        void fetchUserPublicProfiles([result.authorUid])
          .then((profiles) => setProfile(profiles[result.authorUid] ?? null))
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
    [announcementId, session.user?.uid, t],
  );

  const commentsEnabled = Boolean(currentAnnouncement?.commentsEnabled) && categories.announcementCommentsEnabled;
  const fetchCommentPage = React.useCallback(
    ({ cursor, sort, forceRefresh }: CommentPageRequest) =>
      listAnnouncementComments(announcementId, cursor, sort, { cacheScope: session.user?.uid, forceRefresh }),
    [announcementId, session.user?.uid],
  );
  const commentFeed = useCommentFeed({
    enabled: categories.announcementCommentsEnabled && currentAnnouncement?.commentsEnabled !== false,
    targetKey: `${session.user?.uid}|announcement:${announcementId}`,
    fetchPage: fetchCommentPage,
  });

  React.useEffect(() => {
    void load();
  }, [load]);

  const announcementCachePrefixes = React.useMemo(
    () => [`announcement-detail|${announcementId}|`],
    [announcementId],
  );
  useContentInvalidationRefresh(announcementCachePrefixes, () => {
    if (!deletingRef.current) return load(true);
  });

  async function like() {
    if (!currentAnnouncement) return;
    return reaction.run({
      id: currentAnnouncement.id,
      previous: { active: currentAnnouncement.currentUserLiked, count: currentAnnouncement.likeCount },
      apply: ({ active, count }, pending) => patchContentEntity<AnnouncementRecord>(session.user?.uid, "announcement", currentAnnouncement.id, {
        currentUserLiked: active, likeCount: count,
      }, { pending }),
      request: async (active) => {
        const result = await setAnnouncementLike(currentAnnouncement.id, active);
        return { active: result.liked, count: result.likeCount };
      },
      errorMessage: t("ui.announcement.likeFailed"),
    });
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
      navigate(feedHref("announcements"), { replace: true });
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
    const result = await createAnnouncementComment(announcementId, content, parentId);
    if (currentAnnouncement)
      patchContentEntity<AnnouncementRecord>(
        session.user?.uid,
        "announcement",
        currentAnnouncement.id,
        { commentCount: result.commentCount },
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
        { commentCount: result.commentCount },
      );
    await commentFeed.load(true);
  }

  return {
    announcement: currentAnnouncement,
    burst: reaction.burstById[announcementId] ?? 0,
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
    liking: reaction.isBusy(announcementId),
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
